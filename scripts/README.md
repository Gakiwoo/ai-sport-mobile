# Project Scripts

> Reviewed 2026-07-11. Deployment scripts must read credentials from environment variables or managed secrets; never commit server passwords or private keys.

Operational scripts are grouped by task area.

## Deployment

- `deployment/deploy-mediapipe.sh` uploads MediaPipe static assets to the CDN host.
- `deployment/nginx-mediapipe.sh` updates the CDN host Nginx configuration.
- `deployment/ssh-deploy.js` deploys MediaPipe assets over SSH.

Do not commit passwords or private keys in this directory. Use environment variables, SSH agent, or interactive prompts.

## Validation

- `validate-video-dataset.js` validates the 500-video manifest (recorded, annotated, approved states) and strict release gate.
- `algorithm-regression-report.js --strict` reports MAE/MAPE, misses, false detections, and failure samples from approved algorithm evidence.
- `validate-device-stability.js` enforces the 30-minute real-device Android stability report contract.
