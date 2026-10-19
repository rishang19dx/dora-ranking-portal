from django.contrib import admin
from .models import OrgUnit, NodalOfficer

@admin.register(OrgUnit)
class OrgUnitAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'type', 'head', 'email', 'parent')
    list_filter = ('type',)
    search_fields = ('id', 'name', 'head', 'email')

@admin.register(NodalOfficer)
class NodalOfficerAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'designation', 'email', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'email', 'designation')
    filter_horizontal = ('assigned_units',)
