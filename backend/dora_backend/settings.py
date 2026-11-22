import os
from pathlib import Path
from datetime import timedelta
import sys

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Add apps to sys.path so 'apps.<app_name>' can also be imported if needed
sys.path.insert(0, str(BASE_DIR))

def _env_list(name, default=''):
    return [v.strip() for v in os.getenv(name, default).split(',') if v.strip()]


def _env_bool(name, default):
    return os.getenv(name, str(default)).strip().lower() in ('true', '1', 'yes')


def _env_flag(name, default='False'):
    return _env_bool(name, default)


DEV_SECRET_KEY = 'django-insecure-dora-ranking-portal-secret-key-2026'
DEBUG = _env_bool('DJANGO_DEBUG', True)
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', DEV_SECRET_KEY)

# Production gate (Phase 4 security audit, finding SEC-01): a production
# process must never start with the published development key, or with a key
# short enough to brute-force, because it signs every JWT.
if not DEBUG and (SECRET_KEY == DEV_SECRET_KEY or SECRET_KEY.startswith('django-insecure') or len(SECRET_KEY) < 50):
    raise ImproperlyConfigured(
        'DJANGO_SECRET_KEY must be set to a random value of at least 50 characters '
        'when DJANGO_DEBUG is False. Generate one with: '
        'python -c "import secrets; print(secrets.token_urlsafe(64))"'
    )

# SEC-02: hosts are explicit in production; '*' only while debugging.
ALLOWED_HOSTS = _env_list('DJANGO_ALLOWED_HOSTS', '*' if DEBUG else 'localhost,127.0.0.1')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    
    # Internal apps
    'apps.accounts',
    'apps.organogram',
    'apps.data_requests',
    'apps.submissions',
    'apps.rankings',
    'apps.golive',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'dora_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'dora_backend.wsgi.application'

# Database Configuration (SQLite dev default, PostgreSQL in prod)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    import urllib.parse
    parsed = urllib.parse.urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed.path.lstrip('/'),
            'USER': urllib.parse.unquote(parsed.username) if parsed.username else '',
            'PASSWORD': urllib.parse.unquote(parsed.password) if parsed.password else '',
            'HOST': parsed.hostname,
            'PORT': parsed.port or 5432,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            # DJANGO_SQLITE_PATH lets the DR drill restore into a scratch file.
            'NAME': os.getenv('DJANGO_SQLITE_PATH') or (BASE_DIR / 'db.sqlite3'),
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
# DJANGO_MEDIA_ROOT lets the DR drill restore proofs into a scratch folder.
MEDIA_ROOT = Path(os.getenv('DJANGO_MEDIA_ROOT') or (BASE_DIR / 'media'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    # Deny by default (spec 2.18): a view is public only if it says so with
    # AllowAny, so a newly added endpoint can never be open by omission.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # SEC-05: brute-force protection on the login endpoint (scoped throttle
    # applied in accounts.views). Other endpoints are not throttled.
    'DEFAULT_THROTTLE_RATES': {
        'login': os.getenv('LOGIN_THROTTLE_RATE', '10/min'),
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Configuration (SEC-03): any origin while debugging; an explicit
# allow-list in production. The SPA is normally served same-origin behind
# Nginx, so production usually needs no CORS origins at all.
CORS_ALLOWED_ORIGINS = _env_list('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_ALL_ORIGINS = DEBUG and not CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = _env_list('CSRF_TRUSTED_ORIGINS')

# Transport and browser hardening (SEC-04). Enabled whenever DEBUG is off;
# DJANGO_SECURE_SSL_REDIRECT / DJANGO_HSTS_SECONDS can relax them for a
# plain-HTTP campus staging box.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = _env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool('DJANGO_HSTS_INCLUDE_SUBDOMAINS', False)
    SECURE_HSTS_PRELOAD = False
    # Deliberate: ARP cannot vouch for every *.iitmandi.ac.in host, so HSTS is
    # not extended to subdomains or submitted for preload unless IT Services
    # opts in (DJANGO_HSTS_INCLUDE_SUBDOMAINS=True).
    SILENCED_SYSTEM_CHECKS = ['security.W021'] + ([] if SECURE_HSTS_INCLUDE_SUBDOMAINS else ['security.W005'])
    SESSION_COOKIE_SECURE = _env_bool('DJANGO_SECURE_COOKIES', True)
    CSRF_COOKIE_SECURE = _env_bool('DJANGO_SECURE_COOKIES', True)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_HTTPONLY = True
DATA_UPLOAD_MAX_MEMORY_SIZE = 30 * 1024 * 1024  # proofs are capped at 25 MB

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO')},
    'loggers': {'django.security': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False}},
}


# Portal-specific settings
PORTAL_ACCESS_TTL_DAYS = int(os.getenv('PORTAL_ACCESS_TTL_DAYS', '45'))
APP_BASE_URL = os.getenv('APP_BASE_URL', 'http://localhost:5173')
RESEND_API_KEY = os.getenv('RESEND_API_KEY')
MAIL_FROM = os.getenv('MAIL_FROM', 'DORA IIT Mandi <dora@iitmandi.ac.in>')
PORTAL_DATA_DIR = Path(os.getenv('PORTAL_DATA_DIR', str(BASE_DIR.parent / '.data')))
OUTBOX_DIR = PORTAL_DATA_DIR / 'outbox'

# ---------------------------------------------------------------------------
# Phase 4: go-live, backup and disaster recovery
# ---------------------------------------------------------------------------
BACKUP_DIR = Path(os.getenv('BACKUP_DIR', str(BASE_DIR.parent / '.data' / 'backups')))
BACKUP_RETENTION_COUNT = int(os.getenv('BACKUP_RETENTION_COUNT', '14'))
# Targets agreed in the proposal (Appendix B): 24 h RPO, 8 h RTO.
DR_TARGET_RPO_HOURS = float(os.getenv('DR_TARGET_RPO_HOURS', '24'))
DR_TARGET_RTO_HOURS = float(os.getenv('DR_TARGET_RTO_HOURS', '8'))
# Pilot KPI thresholds (proposal section 3.3).
KPI_FLAG_ACCURACY_TARGET = float(os.getenv('KPI_FLAG_ACCURACY_TARGET', '0.95'))
APP_VERSION = os.getenv('APP_VERSION', '2.0.0')

# Automated deadline reminders (apps/data_requests/reminders.py).
REMINDER_DAYS_BEFORE = [int(d) for d in _env_list('REMINDER_DAYS_BEFORE', '7,3,1')]
REMINDER_OVERDUE_INTERVAL_DAYS = int(os.getenv('REMINDER_OVERDUE_INTERVAL_DAYS', '3'))
REMINDER_OVERDUE_MAX = int(os.getenv('REMINDER_OVERDUE_MAX', '3'))
REMINDER_MANUAL_COOLDOWN_HOURS = int(os.getenv('REMINDER_MANUAL_COOLDOWN_HOURS', '20'))

# AI-assisted discrepancy review (apps/submissions/ai_client.py). Optional:
# with no provider/key the rule-based flags work on their own.
AI_PROVIDER = os.getenv('AI_PROVIDER', '')
AI_API_KEY = os.getenv('AI_API_KEY', '')
AI_MODEL = os.getenv('AI_MODEL', '')
AI_BASE_URL = os.getenv('AI_BASE_URL', '')
AI_TIMEOUT_SECONDS = float(os.getenv('AI_TIMEOUT_SECONDS', '30'))
AI_MAX_FLAGS = int(os.getenv('AI_MAX_FLAGS', '60'))

# Rule thresholds for discrepancy flags (apps/submissions/discrepancies.py).
DISCREPANCY_CRITICAL_DROP_PCT = float(os.getenv('DISCREPANCY_CRITICAL_DROP_PCT', '80'))
DISCREPANCY_CRITICAL_RISE_PCT = float(os.getenv('DISCREPANCY_CRITICAL_RISE_PCT', '300'))
DISCREPANCY_WARNING_CHANGE_PCT = float(os.getenv('DISCREPANCY_WARNING_CHANGE_PCT', '40'))
DISCREPANCY_RESTATE_CRITICAL_PCT = float(os.getenv('DISCREPANCY_RESTATE_CRITICAL_PCT', '50'))
DISCREPANCY_RESTATE_WARNING_PCT = float(os.getenv('DISCREPANCY_RESTATE_WARNING_PCT', '5'))
DISCREPANCY_RECORD_WARNING_PCT = float(os.getenv('DISCREPANCY_RECORD_WARNING_PCT', '50'))
