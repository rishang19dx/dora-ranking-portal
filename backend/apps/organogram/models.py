from django.db import models
import uuid

class OrgUnitType(models.TextChoices):
    GOVERNANCE = 'GOVERNANCE', 'Governance'
    EXECUTIVE = 'EXECUTIVE', 'Executive'
    ACADEMIC = 'ACADEMIC', 'Academic'
    ADMINISTRATIVE = 'ADMINISTRATIVE', 'Administrative'
    FUNCTIONAL = 'FUNCTIONAL', 'Functional'

class OrgUnitKind(models.TextChoices):
    SCHOOL = 'SCHOOL', 'School'
    CENTRE = 'CENTRE', 'Centre'
    OFFICE = 'OFFICE', 'Office'

class OrgUnit(models.Model):
    id = models.CharField(max_length=128, primary_key=True)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=128, blank=True, null=True)
    kind = models.CharField(
        max_length=32,
        choices=OrgUnitKind.choices,
        default=OrgUnitKind.OFFICE
    )
    type = models.CharField(max_length=32, choices=OrgUnitType.choices)
    head = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    data_scopes = models.JSONField(default=list, blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.name} ({self.id})"

class OfficerStatus(models.TextChoices):
    INVITED = 'INVITED', 'Invited'
    ACTIVE = 'ACTIVE', 'Active'
    REVOKED = 'REVOKED', 'Revoked'

def generate_officer_id():
    return f"no_{uuid.uuid4().hex[:12]}"

class NodalOfficer(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_officer_id)
    name = models.CharField(max_length=255)
    designation = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=32,
        choices=OfficerStatus.choices,
        default=OfficerStatus.INVITED
    )
    last_invited_at = models.DateTimeField(blank=True, null=True)
    assigned_units = models.ManyToManyField(
        OrgUnit,
        related_name='nodal_officers',
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} <{self.email}>"

def generate_programme_id():
    return f"prg_{uuid.uuid4().hex[:12]}"

class Programme(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_programme_id)
    unit = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name='programmes')
    name = models.CharField(max_length=255)
    nirf_level = models.CharField(max_length=32)
    active = models.BooleanField(default=True)
    start_academic_year = models.CharField(max_length=32, blank=True, null=True)
    end_academic_year = models.CharField(max_length=32, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['unit', 'name']

    def __str__(self):
        return f"{self.name} ({self.nirf_level}) - {self.unit.short_name or self.unit.id}"
