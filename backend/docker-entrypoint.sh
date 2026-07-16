#!/bin/sh
set -e

# Control-plane migrations run on boot; tenant DBs are migrated by the
# provisioner. In K8s move this into an initContainer/Job.
python manage.py migrate --noinput

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${WEB_CONCURRENCY:-4}" \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
