<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * In-app notifications (docs/WORKFLOW_CONTRACT.md section 3,
 * DEC-026). Notifications are system-generated: this controller only
 * reads and marks read. Every query is pinned to the token identity
 * AND the token's agency (via the BelongsToAgency scope), so a
 * foreign or other-user id resolves to 404. No permission key — any
 * active staff membership reads its own notifications.
 */
class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $notifications = Notification::query()
            ->where('user_id', $request->user()->id)
            ->when($request->boolean('unread'), fn ($q) => $q->unread())
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return NotificationResource::collection($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::query()
            ->where('user_id', $request->user()->id)
            ->unread()
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = Notification::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        if (! $notification->isRead()) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        // Wrapped by hand: the resource payload itself has a top-level
        // `data` key (the notification's params), which Laravel's
        // resource responder would mistake for its own `data` wrapper
        // and skip wrapping — every other endpoint answers {data: ...}.
        return response()->json(['data' => NotificationResource::make($notification)->resolve($request)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        Notification::query()
            ->where('user_id', $request->user()->id)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['data' => ['count' => 0]]);
    }
}
