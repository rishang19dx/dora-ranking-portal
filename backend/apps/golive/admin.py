from django.contrib import admin

from .models import (
    DisasterRecoveryDrill,
    FlagReview,
    Pilot,
    SignOff,
    TrainingSession,
    UatExecution,
    UatScenario,
)


@admin.register(Pilot)
class PilotAdmin(admin.ModelAdmin):
    list_display = ('name', 'cycle_year', 'status', 'started_at', 'ended_at')
    filter_horizontal = ('units', 'requests')


@admin.register(FlagReview)
class FlagReviewAdmin(admin.ModelAdmin):
    list_display = ('check_id', 'request', 'severity', 'system_flagged', 'verdict', 'reviewer')
    list_filter = ('verdict', 'severity', 'system_flagged')


@admin.register(DisasterRecoveryDrill)
class DrillAdmin(admin.ModelAdmin):
    list_display = ('kind', 'backup_name', 'failure_declared_at', 'integrity_ok', 'witnessed_by')


@admin.register(UatScenario)
class UatScenarioAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'area', 'role', 'priority', 'active')


@admin.register(UatExecution)
class UatExecutionAdmin(admin.ModelAdmin):
    list_display = ('scenario', 'status', 'tester_name', 'executed_at')


@admin.register(TrainingSession)
class TrainingSessionAdmin(admin.ModelAdmin):
    list_display = ('title', 'audience', 'held_on', 'trainer', 'attendees')


@admin.register(SignOff)
class SignOffAdmin(admin.ModelAdmin):
    list_display = ('kind', 'decision', 'signatory_name', 'designation', 'created_at')

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
