#!/bin/sh
# Container start-up: bring the schema and reference data up to date, then
# hand over to the CMD (gunicorn). Every step is idempotent.
set -e

python manage.py migrate --noinput
python manage.py seed_organogram
python manage.py load_form_schema
python manage.py seed_uat_scenarios
python manage.py collectstatic --noinput

exec "$@"
