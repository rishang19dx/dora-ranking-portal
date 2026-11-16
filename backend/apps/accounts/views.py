from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import ADMIN, IsAdmin, effective_role
from .serializers import CustomTokenObtainPairSerializer, ManagedUserSerializer, UserSerializer

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


def _active_admin_count(exclude_pk=None):
    admins = User.objects.filter(is_active=True)
    if exclude_pk is not None:
        admins = admins.exclude(pk=exclude_pk)
    return sum(1 for u in admins if effective_role(u) == ADMIN)


class UserListCreateView(APIView):
    """Admin-only account management (spec 2.18): who holds which role."""
    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.order_by('username')
        role = request.query_params.get('role')
        if role:
            users = [u for u in users if effective_role(u) == role]
        return Response(ManagedUserSerializer(users, many=True).data)

    def post(self, request):
        serializer = ManagedUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(ManagedUserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    Change a user's role, details or password, or deactivate them.

    There is no delete: audit entries name the actor, so accounts are
    deactivated instead. Two lock-out guards apply: an admin cannot demote or
    deactivate themselves, and the last active admin cannot be removed.
    """
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        return Response(ManagedUserSerializer(get_object_or_404(User, pk=pk)).data)

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        serializer = ManagedUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data.get('role', user.role)
        new_active = serializer.validated_data.get('is_active', user.is_active)
        loses_admin = effective_role(user) == ADMIN and (
            not new_active or (new_role != ADMIN and not user.is_superuser)
        )
        if loses_admin:
            if user.pk == request.user.pk:
                return Response(
                    {'error': 'You cannot remove your own admin access.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _active_admin_count(exclude_pk=user.pk) == 0:
                return Response(
                    {'error': 'At least one active admin must remain.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user = serializer.save()
        return Response(ManagedUserSerializer(user).data)
