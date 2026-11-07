"""Independent SciPy/DOP853 validation of exported Aurora RK4 candidate states.
Run frontend validate:mission first. No application code is imported here.
"""
import hashlib
import json
from pathlib import Path
import platform
import numpy as np
import scipy
from scipy.integrate import solve_ivp, quad
from scipy.optimize import minimize_scalar

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'docs/generated/candidate-states.json'
raw = INPUT.read_bytes()
bundle = json.loads(raw)
s = bundle['scenario']
cfg = s['config']
mu, radius, j2 = 3.986004418e14, 6378137.0, 1.08262668e-3

def rhs(_t, x):
    r = x[:3]
    mag = np.linalg.norm(r)
    acceleration = -mu * r / mag**3
    if cfg['forceModel'] == 'J2':
        q = (r[2] / mag)**2
        acceleration += (1.5*j2*mu*radius**2/mag**5)*r*np.array([5*q-1, 5*q-1, 5*q-3])
    return np.r_[x[3:], acceleration]

def state(obj):
    return np.array(obj['state']['r']+obj['state']['v'], dtype=float)

def propagate(x, duration, dense=False):
    if abs(duration) < 1e-12:
        return x.copy()
    result = solve_ivp(rhs, (0, duration), x, method='DOP853', rtol=2e-13, atol=1e-9, dense_output=dense)
    if not result.success:
        raise RuntimeError(result.message)
    return result.sol if dense else result.y[:, -1]

def primary_map(x, dv, offset, noise=np.zeros(3)):
    burn = propagate(x, -cfg['burnLeadSeconds'])
    radial = burn[:3] / np.linalg.norm(burn[:3])
    normal = np.cross(burn[:3], burn[3:]); normal /= np.linalg.norm(normal)
    along = np.cross(normal, radial)
    burn[3:] += np.column_stack([radial, along, normal]) @ dv + noise
    return propagate(burn, cfg['burnLeadSeconds']+offset)

def jacobian(x, function):
    result = np.zeros((3, 6))
    for i in range(6):
        h = 2.0 if i < 3 else 0.002
        step = np.zeros(6); step[i] = h
        result[:, i] = (function(x+step)[:3]-function(x-step)[:3])/(2*h)
    return result

def probability(a, b, covariance):
    dr, dv = b[:3]-a[:3], b[3:]-a[3:]
    y = dv / np.linalg.norm(dv)
    helper = np.array([0., 0., 1.]) if abs(y[2]) < .9 else np.array([1., 0., 0.])
    u = np.cross(y, helper); u /= np.linalg.norm(u)
    w = np.cross(y, u)
    basis = np.vstack([u,w])
    mean = basis @ dr
    projected = basis @ covariance @ basis.T
    inverse = np.linalg.inv(projected)
    determinant = np.linalg.det(projected)
    hbr = s['primary']['radiusM'] + s['secondary']['radiusM']
    def radial(r):
        def angular(theta):
            x = r*np.array([np.cos(theta), np.sin(theta)])-mean
            return np.exp(-.5*x@inverse@x) * r/(2*np.pi*np.sqrt(determinant))
        return quad(angular, 0, 2*np.pi, epsabs=1e-14, epsrel=1e-8)[0]
    return quad(radial, 0, hbr, epsabs=1e-14, epsrel=1e-8)[0]

primary, secondary = state(s['primary']), state(s['secondary'])
rows = []
for c in bundle['analysis']['candidates']:
    dv = np.array(c['deltaVRtn'])
    offset = c['tcaOffsetSeconds']
    p = primary_map(primary, dv, offset)
    q = propagate(secondary, offset)
    expected_p = np.array(c['primaryAtTca']['r']+c['primaryAtTca']['v'])
    expected_q = np.array(c['secondaryAtTca']['r']+c['secondaryAtTca']['v'])
    # Independent minimization around the numerical TCA, rather than copying its time.
    objective = lambda t: np.linalg.norm(primary_map(primary, dv, t)[:3]-propagate(secondary,t)[:3])
    optimum = minimize_scalar(objective, bounds=(max(-cfg['encounterWindowSeconds'],offset-1), min(cfg['encounterWindowSeconds'],offset+1)), method='bounded', options={'xatol':1e-7})
    a = jacobian(primary, lambda x: primary_map(x, dv, offset))
    b = jacobian(secondary, lambda x: propagate(x,offset))
    covariance = a@np.array(s['primary']['stateCovariance'])@a.T + b@np.array(s['secondary']['stateCovariance'])@b.T
    if c['deltaVMs'] > 0:
        burn_jac = np.zeros((3,3))
        for i in range(3):
            n = np.zeros(3); n[i]=.002
            burn_jac[:,i]=(primary_map(primary,dv,offset,n)[:3]-primary_map(primary,dv,offset,-n)[:3])/.004
        covariance += cfg['burnExecutionSigmaMs']**2 * burn_jac@burn_jac.T
    pc = probability(p,q,covariance)
    row = dict(id=c['id'],positionErrorM=max(np.linalg.norm(p[:3]-expected_p[:3]),np.linalg.norm(q[:3]-expected_q[:3])),velocityErrorMs=max(np.linalg.norm(p[3:]-expected_p[3:]),np.linalg.norm(q[3:]-expected_q[3:])),missDistanceErrorM=abs(optimum.fun-c['missDistanceM']),tcaErrorSeconds=abs(optimum.x-offset),independentPc=pc,pcAbsoluteError=abs(pc-c['computedPc']))
    assert row['positionErrorM'] < .1, row
    assert row['velocityErrorMs'] < .001, row
    assert row['missDistanceErrorM'] < .1, row
    assert row['tcaErrorSeconds'] < .001, row
    assert row['pcAbsoluteError'] < 1e-8, row
    rows.append(row)
report = dict(schema='aurora-independent-dynamics-v1',inputSha256=hashlib.sha256(raw).hexdigest(),method='SciPy DOP853 + independent bounded TCA minimization + central differences + adaptive Gaussian-disk quadrature',python=platform.python_version(),scipy=scipy.__version__,numpy=np.__version__,tolerances=dict(positionM=.1,velocityMs=.001,missDistanceM=.1,tcaSeconds=.001,pcAbsolute=1e-8),results=rows,limitations='Same force-model equations; independent numerical integrator. Does not validate omitted forces or observational covariance realism.')
(ROOT/'docs/generated/independent-dynamics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
