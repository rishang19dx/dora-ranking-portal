"""
Create (or repair) the bootstrap Admin account.

    DORA_ADMIN_USERNAME   default "admin"
    DORA_ADMIN_PASSWORD   required when DJANGO_DEBUG is off
    DORA_ADMIN_EMAIL      optional

Idempotent, so deploy scripts can run it on every release. An existing
account keeps its password unless --reset-password is passed; its role is
put back to ADMIN and it is re-activated, so a locked-out operator can always
recover with shell access. Further accounts are made in the portal's
Users & Roles page.
"""
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import UserRole

DEV_PASSWORD = 'admin123'


class Command(BaseCommand):
    help = 'Create or repair the bootstrap Admin account from DORA_ADMIN_* environment variables.'

    def add_arguments(self, parser):
        parser.add_argument('--reset-password', action='store_true',
                            help='Overwrite the password of an existing account.')

    def handle(self, *args, **opts):
        username = os.getenv('DORA_ADMIN_USERNAME', 'admin')
        email = os.getenv('DORA_ADMIN_EMAIL', '')
        password = os.getenv('DORA_ADMIN_PASSWORD')

        if not password:
            if not settings.DEBUG:
                raise CommandError('Set DORA_ADMIN_PASSWORD: the development default is refused with DEBUG off.')
            password = DEV_PASSWORD
        elif not settings.DEBUG and password == DEV_PASSWORD:
            raise CommandError('Refusing the development password with DEBUG off.')

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={'email': email})
        if created or opts['reset_password']:
            user.set_password(password)
        if email:
            user.email = email
        user.role = UserRole.ADMIN
        user.is_active = True
        user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f"{verb} admin account '{username}'."))
        if password == DEV_PASSWORD and (created or opts['reset_password']):
            self.stdout.write(self.style.WARNING('Using the development password; set DORA_ADMIN_PASSWORD for any shared install.'))
