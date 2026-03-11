use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use chrono::Utc;
use futures::StreamExt;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server, StatusCode};
use prometheus::{Encoder, HistogramOpts, Registry, TextEncoder};
use rdkafka::consumer::StreamConsumer;
use rdkafka::producer::{FutureProducer, FutureRecord, Producer as KafkaProducer};
use rdkafka::ClientConfig;
use rdkafka::Message;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{info, warn};

// ── TLE record (matches CelesTrak gpRecord published by ingestion) ──────────

#[derive(Debug, Clone, Deserialize)]
#[allow(non_snake_case, dead_code)]
struct GpRecord {
    OBJECT_NAME: Option<String>,
    NORAD_CAT_ID: Option<serde_json::Value>,
    OBJECT_TYPE: Option<String>,
    TLE_LINE1: Option<String>,
    TLE_LINE2: Option<String>,
    MEAN_MOTION: Option<f64>,
    INCLINATION: Option<f64>,
    ECCENTRICITY: Option<f64>,
    PERIOD: Option<f64>,
    APOAPSIS: Option<f64>,
    PERIAPSIS: Option<f64>,
    SEMIMAJOR_AXIS: Option<f64>,
}

impl GpRecord {
    fn norad_id(&self) -> Option<i64> {
        match &self.NORAD_CAT_ID {
            Some(serde_json::Value::Number(n)) => n.as_i64(),
            Some(serde_json::Value::String(s)) => s.trim().parse::<i64>().ok(),
            _ => None,
        }
    }

    fn norad_id_str(&self) -> String {
        self.norad_id().map(|n| n.to_string()).unwrap_or_default()
    }
}

// ── Output format (matches shared.Satellite + SatelliteBatch) ───────────────

#[derive(Debug, Clone, Serialize)]
struct SatellitePosition {
    #[serde(rename = "noradId")]
    norad_id: i64,
    name: String,
    lat: f64,
    #[serde(rename = "lon")]
    lon: f64,
    #[serde(rename = "altitudeKm")]
    altitude_km: f64,
    #[serde(rename = "velocityKms")]
    velocity_kms: f64,
    #[serde(rename = "orbitType")]
    orbit_type: String,
    #[serde(rename = "riskLevel")]
    risk_level: String,
    owner: String,
    #[serde(rename = "conjunctionCount")]
    conjunction_count: i32,
}

#[derive(Debug, Serialize)]
struct SatelliteBatch {
    #[serde(rename = "batchId")]
    batch_id: String,
    #[serde(rename = "batchIndex")]
    batch_index: usize,
    #[serde(rename = "batchCount")]
    batch_count: usize,
    satellites: Vec<SatellitePosition>,
}

// ── Orbit classification ────────────────────────────────────────────────────

fn classify_orbit(alt_km: f64) -> &'static str {
    if alt_km < 2000.0 {
        "LEO"
    } else if alt_km < 35786.0 {
        "MEO"
    } else if alt_km < 35887.0 {
        "GEO"
    } else {
        "HEO"
    }
}

// ── GMST calculation ────────────────────────────────────────────────────────

fn gmst_radians(dt: chrono::DateTime<Utc>) -> f64 {
    let j2000 = chrono::NaiveDate::from_ymd_opt(2000, 1, 1)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap()
        .and_utc();
    let d = (dt - j2000).num_seconds() as f64 / 86400.0;
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst.rem_euclid(360.0).to_radians()
}

// ── ECI to Geodetic (Zhu method) ────────────────────────────────────────────

fn eci_to_geodetic(pos_km: [f64; 3], gmst_rad: f64) -> (f64, f64, f64) {
    // ECEF
    let x = pos_km[0] * gmst_rad.cos() + pos_km[1] * gmst_rad.sin();
    let y = -pos_km[0] * gmst_rad.sin() + pos_km[1] * gmst_rad.cos();
    let z = pos_km[2];

    // WGS84 constants
    let a: f64 = 6378.137;
    let e2: f64 = 0.00669437999014;

    let lon = y.atan2(x).to_degrees();
    let p = (x * x + y * y).sqrt();

    // Iterative latitude
    let mut lat = z.atan2(p * (1.0 - e2));
    for _ in 0..5 {
        let sin_lat = lat.sin();
        let n = a / (1.0 - e2 * sin_lat * sin_lat).sqrt();
        lat = (z + e2 * n * sin_lat).atan2(p);
    }

    let sin_lat = lat.sin();
    let n = a / (1.0 - e2 * sin_lat * sin_lat).sqrt();
    let alt = p / lat.cos() - n;

    (lat.to_degrees(), lon, alt)
}

// ── TLE validation (matches Go isTLEValid) ──────────────────────────────────

fn is_tle_valid(rec: &GpRecord) -> bool {
    let line1 = rec.TLE_LINE1.as_deref().unwrap_or("").trim();
    let line2 = rec.TLE_LINE2.as_deref().unwrap_or("").trim();

    if line1.len() < 69 || line2.len() < 69 {
        return false;
    }
    if !line1.starts_with("1 ") || !line2.starts_with("2 ") {
        return false;
    }

    let ecc = rec.ECCENTRICITY.unwrap_or(-1.0);
    if ecc >= 1.0 || ecc < 0.0 {
        return false;
    }
    if ecc > 0.9 {
        return false;
    }

    let mm = rec.MEAN_MOTION.unwrap_or(0.0);
    if mm <= 0.0 {
        return false;
    }

    true
}

// ── SGP4 propagation ────────────────────────────────────────────────────────

fn propagate_satellite(rec: &GpRecord) -> Option<SatellitePosition> {
    let line1 = rec.TLE_LINE1.as_deref()?.trim();
    let line2 = rec.TLE_LINE2.as_deref()?.trim();
    let norad_id = rec.norad_id()?;
    let name = rec.OBJECT_NAME.clone().unwrap_or_default();

    let elements = sgp4::Elements::from_tle(
        Some(name.clone()),
        line1.as_bytes(),
        line2.as_bytes(),
    )
    .ok()?;

    let constants = sgp4::Constants::from_elements(&elements).ok()?;

    let now = Utc::now();
    let epoch = elements.datetime;
    let epoch_utc = epoch.and_utc();

    let minutes_since_epoch = (now - epoch_utc).num_seconds() as f64 / 60.0;

    let prediction = constants
        .propagate(sgp4::MinutesSinceEpoch(minutes_since_epoch))
        .ok()?;

    let pos = prediction.position;
    let vel = prediction.velocity;

    // Check for NaN/infinite
    if pos[0].is_nan()
        || pos[1].is_nan()
        || pos[2].is_nan()
        || pos[0].is_infinite()
        || pos[1].is_infinite()
        || pos[2].is_infinite()
    {
        return None;
    }

    let gmst = gmst_radians(now);
    let (lat, lon, alt) = eci_to_geodetic([pos[0], pos[1], pos[2]], gmst);

    // Filter invalid altitudes
    if alt < -100.0 || alt > 60000.0 {
        return None;
    }

    let velocity_kms = (vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]).sqrt();

    Some(SatellitePosition {
        norad_id,
        name,
        lat,
        lon,
        altitude_km: alt,
        velocity_kms,
        orbit_type: classify_orbit(alt).to_string(),
        risk_level: "nominal".to_string(),
        owner: String::new(),
        conjunction_count: 0,
    })
}

// ── Prometheus metrics ──────────────────────────────────────────────────────

struct Metrics {
    satellites_tracked: prometheus::Gauge,
    propagation_latency_ms: prometheus::Histogram,
    propagation_errors_total: prometheus::IntCounter,
    tle_cache_size: prometheus::Gauge,
    registry: Registry,
}

impl Metrics {
    fn new() -> Self {
        let registry = Registry::new();

        let satellites_tracked = prometheus::Gauge::new(
            "aurora_satellites_tracked",
            "Number of satellites in TLE cache",
        )
        .unwrap();

        let propagation_latency_ms = prometheus::Histogram::with_opts(HistogramOpts::new(
            "aurora_engine_propagation_latency_ms",
            "Propagation cycle latency in milliseconds",
        )
        .buckets(vec![
            10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0,
        ]))
        .unwrap();

        let propagation_errors_total = prometheus::IntCounter::new(
            "aurora_engine_propagation_errors_total",
            "Total SGP4 propagation errors",
        )
        .unwrap();

        let tle_cache_size =
            prometheus::Gauge::new("aurora_engine_tle_cache_size", "Number of TLEs in cache")
                .unwrap();

        registry
            .register(Box::new(satellites_tracked.clone()))
            .unwrap();
        registry
            .register(Box::new(propagation_latency_ms.clone()))
            .unwrap();
        registry
            .register(Box::new(propagation_errors_total.clone()))
            .unwrap();
        registry
            .register(Box::new(tle_cache_size.clone()))
            .unwrap();

        Self {
            satellites_tracked,
            propagation_latency_ms,
            propagation_errors_total,
            tle_cache_size,
            registry,
        }
    }
}

// ── TLE Cache ───────────────────────────────────────────────────────────────

type TleCache = Arc<RwLock<HashMap<String, GpRecord>>>;

// ── Bulk load TLEs from Kafka ───────────────────────────────────────────────

async fn bulk_load_tles(brokers: &str, cache: &TleCache) {
    use rdkafka::config::RDKafkaLogLevel;
    use rdkafka::consumer::{BaseConsumer, Consumer as _};

    let consumer: BaseConsumer = ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("group.id", "aurora-engine-bulk-load-temp")
        .set("auto.offset.reset", "earliest")
        .set("enable.auto.commit", "false")
        .set("fetch.wait.max.ms", "500")
        .set_log_level(RDKafkaLogLevel::Warning)
        .create()
        .expect("Failed to create bulk load consumer");

    consumer
        .subscribe(&["aurora.satellites.tle"])
        .expect("Failed to subscribe to TLE topic");

    info!("TLE bulk load started");

    let deadline = Instant::now() + Duration::from_secs(10);
    let mut ingested: u64 = 0;

    loop {
        if Instant::now() > deadline {
            let count = cache.read().await.len();
            info!(
                ingested = ingested,
                unique = count,
                "initial TLE load complete (deadline)"
            );
            break;
        }

        match consumer.poll(Duration::from_secs(2)) {
            Some(Ok(msg)) => {
                if let Some(payload) = msg.payload() {
                    if let Ok(rec) = serde_json::from_slice::<GpRecord>(payload) {
                        if let Some(id) = rec.norad_id() {
                            if id > 0 {
                                cache.write().await.insert(id.to_string(), rec);
                                ingested += 1;

                                if ingested % 5000 == 0 {
                                    let count = cache.read().await.len();
                                    info!(
                                        ingested = ingested,
                                        unique = count,
                                        "TLE bulk load progress"
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Some(Err(e)) => {
                warn!(err = %e, "bulk load read error");
            }
            None => {
                // Poll returned nothing — we've caught up
                let count = cache.read().await.len();
                info!(
                    ingested = ingested,
                    unique = count,
                    "initial TLE load complete"
                );
                break;
            }
        }
    }
}

// ── Ongoing TLE consumer ────────────────────────────────────────────────────

async fn consume_tle_updates(
    brokers: &str,
    cache: TleCache,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) {
    use rdkafka::config::RDKafkaLogLevel;
    use rdkafka::consumer::Consumer as _;

    let consumer: StreamConsumer = ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("group.id", "aurora-engine")
        .set("auto.offset.reset", "earliest")
        .set("enable.auto.commit", "true")
        .set("auto.commit.interval.ms", "1000")
        .set_log_level(RDKafkaLogLevel::Warning)
        .create()
        .expect("Failed to create TLE update consumer");

    consumer
        .subscribe(&["aurora.satellites.tle"])
        .expect("Failed to subscribe to TLE topic");

    info!("TLE update consumer started");

    let mut stream = consumer.stream();

    loop {
        tokio::select! {
            _ = shutdown.changed() => {
                info!("TLE update consumer stopping");
                return;
            }
            msg = stream.next() => {
                match msg {
                    Some(Ok(msg)) => {
                        if let Some(payload) = msg.payload() {
                            if let Ok(rec) = serde_json::from_slice::<GpRecord>(payload) {
                                if let Some(id) = rec.norad_id() {
                                    if id > 0 {
                                        cache.write().await.insert(id.to_string(), rec);
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        warn!(err = %e, "TLE read error");
                    }
                    None => {
                        return;
                    }
                }
            }
        }
    }
}

// ── Propagation + publish ───────────────────────────────────────────────────

const BATCH_SIZE: usize = 2000;

async fn propagate_and_publish(
    cache: &TleCache,
    producer: &FutureProducer,
    metrics: &Metrics,
) {
    let records: Vec<GpRecord> = {
        let lock = cache.read().await;
        if lock.is_empty() {
            return;
        }
        metrics.satellites_tracked.set(lock.len() as f64);
        metrics.tle_cache_size.set(lock.len() as f64);
        lock.values().cloned().collect()
    };

    let total = records.len();
    info!(total = total, "propagation starting");

    let start = Instant::now();

    // Pre-filter valid TLEs
    let mut valid = Vec::with_capacity(total);
    let mut skipped = 0;
    for rec in &records {
        if is_tle_valid(rec) {
            valid.push(rec);
        } else {
            skipped += 1;
        }
    }
    info!(
        valid = valid.len(),
        skipped = skipped,
        "TLE validation done"
    );

    let mut positions = Vec::with_capacity(valid.len());
    let mut err_count: u64 = 0;

    for (i, rec) in valid.iter().enumerate() {
        match propagate_satellite(rec) {
            Some(sat) => positions.push(sat),
            None => {
                err_count += 1;
                let norad = rec.norad_id_str();
                warn!(norad_id = %norad, "sgp4 error");
            }
        }
        if (i + 1) % 1000 == 0 {
            info!(
                processed = i + 1,
                ok = positions.len(),
                errors = err_count,
                "propagation progress"
            );
        }
    }

    let elapsed_ms = start.elapsed().as_millis() as f64;
    metrics.propagation_latency_ms.observe(elapsed_ms);
    metrics.propagation_errors_total.inc_by(err_count);

    if positions.is_empty() {
        return;
    }

    info!(
        satellites = positions.len(),
        errors = err_count,
        duration_ms = elapsed_ms,
        "propagation complete"
    );

    // Publish in batches
    let batch_count = (positions.len() + BATCH_SIZE - 1) / BATCH_SIZE;
    let batch_id = format!("{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

    for batch_index in 0..batch_count {
        let start_idx = batch_index * BATCH_SIZE;
        let end_idx = std::cmp::min(start_idx + BATCH_SIZE, positions.len());

        let batch = SatelliteBatch {
            batch_id: batch_id.clone(),
            batch_index,
            batch_count,
            satellites: positions[start_idx..end_idx].to_vec(),
        };

        let data = match serde_json::to_vec(&batch) {
            Ok(d) => d,
            Err(e) => {
                warn!(err = %e, "batch serialize failed");
                continue;
            }
        };

        let key = format!("{}-{}", batch_id, batch_index);
        let record = FutureRecord::to("aurora.satellites.positions")
            .key(&key)
            .payload(&data);

        match producer.send(record, Duration::from_secs(5)).await {
            Ok(_) => {}
            Err((e, _)) => {
                warn!(err = %e, "publish positions failed");
            }
        }
    }

    info!(
        count = positions.len(),
        batches = batch_count,
        latency_ms = elapsed_ms,
        "published positions"
    );
}

// ── Metrics HTTP server ─────────────────────────────────────────────────────

async fn metrics_handler(
    _req: Request<Body>,
    registry: Arc<Registry>,
) -> Result<Response<Body>, hyper::Error> {
    let encoder = TextEncoder::new();
    let metric_families = registry.gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", encoder.format_type())
        .body(Body::from(buffer))
        .unwrap())
}

// ── Main ────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();

    // Logging
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    let env_filter = tracing_subscriber::EnvFilter::try_new(&log_level)
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .json()
        .with_env_filter(env_filter)
        .init();

    info!("aurora rust engine starting");

    let brokers = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let metrics_port = std::env::var("METRICS_PORT").unwrap_or_else(|_| "2114".to_string());

    // Kafka producer
    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .set("message.timeout.ms", "5000")
        .set("linger.ms", "50")
        .set("acks", "1")
        .create()
        .expect("Failed to create Kafka producer");

    let cache: TleCache = Arc::new(RwLock::new(HashMap::new()));
    let metrics = Arc::new(Metrics::new());

    // Metrics HTTP server
    let metrics_registry = Arc::new(metrics.registry.clone());
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", metrics_port).parse().unwrap();

    tokio::spawn(async move {
        info!(addr = %addr, "metrics server starting");
        let make_svc = make_service_fn(move |_conn| {
            let registry = metrics_registry.clone();
            async move {
                Ok::<_, hyper::Error>(service_fn(move |req| {
                    metrics_handler(req, registry.clone())
                }))
            }
        });
        if let Err(e) = Server::bind(&addr).serve(make_svc).await {
            warn!(err = %e, "metrics server failed");
        }
    });

    // Shutdown signal
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    // Phase 1: Bulk-load TLEs
    info!("bulk loading TLEs");
    bulk_load_tles(&brokers, &cache).await;

    let count = cache.read().await.len();
    info!(satellites = count, "TLE load ready, starting propagation");

    // Phase 2: Background TLE consumer
    let cache_clone = cache.clone();
    let brokers_clone = brokers.clone();
    tokio::spawn(async move {
        consume_tle_updates(&brokers_clone, cache_clone, shutdown_rx).await;
    });

    // Phase 3: Propagation loop (30s tick, first run immediately)
    let cache_prop = cache.clone();
    let producer_prop = producer.clone();
    let metrics_prop = metrics.clone();
    let mut shutdown_rx2 = shutdown_tx.subscribe();

    let prop_handle = tokio::spawn(async move {
        // Run first propagation immediately
        propagate_and_publish(&cache_prop, &producer_prop, &metrics_prop).await;

        let mut interval = tokio::time::interval(Duration::from_secs(30));
        interval.tick().await; // consume the immediate first tick

        loop {
            tokio::select! {
                _ = shutdown_rx2.changed() => {
                    info!("propagation loop stopping");
                    return;
                }
                _ = interval.tick() => {
                    propagate_and_publish(&cache_prop, &producer_prop, &metrics_prop).await;
                }
            }
        }
    });

    info!("aurora rust engine running");

    // Wait for shutdown signal
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut sigint = signal(SignalKind::interrupt()).unwrap();
        let mut sigterm = signal(SignalKind::terminate()).unwrap();
        tokio::select! {
            _ = sigint.recv() => info!("received SIGINT"),
            _ = sigterm.recv() => info!("received SIGTERM"),
        }
    }

    #[cfg(not(unix))]
    {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to listen for ctrl_c");
        info!("received ctrl_c");
    }

    info!("shutting down");
    let _ = shutdown_tx.send(true);

    // Wait for propagation loop to finish
    let _ = prop_handle.await;

    // Flush producer
    let _ = producer.flush(Duration::from_secs(5));

    info!("aurora rust engine stopped");
}
