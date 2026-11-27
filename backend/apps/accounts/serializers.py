from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserRole
from .permissions import effective_role

User = get_user_model()


def user_payload(user):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        # The effective role, so a superuser created with `createsuperuser`
        # (whose stored role defaults to NODAL_OFFICER) lands on the admin UI.
        'role': effective_role(user),
        'first_name': user.first_name,
        'last_name': user.last_name,
    }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = effective_role(user)
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        return token

    def validate(self, attrs):
        # Staff know their institutional email better than a username, so
        # either is accepted. An email shared by two accounts is ambiguous and
        # falls through to a normal (failing) username lookup.
        login = (attrs.get(self.username_field) or '').strip()
        if '@' in login:
            matches = list(User.objects.filter(email__iexact=login).values_list('username', flat=True)[:2])
            if len(matches) == 1:
                attrs[self.username_field] = matches[0]
        data = super().validate(attrs)
        data['user'] = user_payload(self.user)
        return data


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone']
        read_only_fields = ['id']

    def get_role(self, obj):
        return effective_role(obj)


class ManagedUserSerializer(serializers.ModelSerializer):
    """Admin user management: create accounts, assign roles, deactivate."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    lastLogin = serializers.DateTimeField(source='last_login', read_only=True)
    dateJoined = serializers.DateTimeField(source='date_joined', read_only=True)
    isActive = serializers.BooleanField(source='is_active', required=False)
    isSuperuser = serializers.BooleanField(source='is_superuser', read_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'phone', 'role',
            'isActive', 'isSuperuser', 'lastLogin', 'dateJoined', 'password',
        ]
        read_only_fields = ['id']

    def validate_email(self, value):
        value = (value or '').strip()
        if value:
            clash = User.objects.filter(email__iexact=value)
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError('Another account already uses this email.')
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        if self.instance is None and not password:
            raise serializers.ValidationError({'password': 'A password is required for a new account.'})
        if password:
            candidate = self.instance or User(
                username=attrs.get('username', ''), email=attrs.get('email', ''),
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated):
        password = validated.pop('password')
        user = User(**validated)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated):
        password = validated.pop('password', None)
        for field, value in validated.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
