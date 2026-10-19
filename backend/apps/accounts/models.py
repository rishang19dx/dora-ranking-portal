from django.contrib.auth.models import AbstractUser
from django.db import models

class UserRole(models.TextChoices):
    ADMIN = 'ADMIN', 'Admin'
    NODAL_OFFICER = 'NODAL_OFFICER', 'Nodal Officer'
    DIRECTOR = 'DIRECTOR', 'Director'
    AUDITOR = 'AUDITOR', 'Auditor'

class User(AbstractUser):
    role = models.CharField(
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.NODAL_OFFICER,
    )
    phone = models.CharField(max_length=32, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
