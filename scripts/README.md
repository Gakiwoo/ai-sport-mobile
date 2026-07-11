# Project Scripts

Operational scripts are grouped by task area.

## Deployment

- `deployment/deploy-mediapipe.sh` uploads MediaPipe static assets to the CDN host.
- `deployment/nginx-mediapipe.sh` updates the CDN host Nginx configuration.
- `deployment/ssh-deploy.js` deploys MediaPipe assets over SSH.

Do not commit passwords or private keys in this directory. Use environment variables, SSH agent, or interactive prompts.

## Validation

- `validate-video-dataset.js` validates the 500-video manifest and strict release gate.
- `algorithm-regression-report.js` summarizes approved algorithm evidence.
- `validate-device-stability.js` validates a real 30-minute Android stability report.
