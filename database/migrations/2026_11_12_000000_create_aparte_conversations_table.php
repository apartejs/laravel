<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(config('aparte.conversations.table', 'aparte_conversations'), function (Blueprint $table) {
            $table->id();
            // The browser creates the id, so it only means something under its owner.
            $table->string('conversation_id', 64);
            $table->string('owner_type');
            $table->string('owner_id');
            $table->string('title')->default('');
            // The chat's own dates, in milliseconds: a rename or a pin must not move them.
            $table->unsignedBigInteger('created_ms')->default(0);
            $table->unsignedBigInteger('updated_ms')->default(0);
            $table->unsignedBigInteger('pinned_ms')->nullable();
            $table->unsignedBigInteger('archived_ms')->nullable();
            $table->unsignedSmallInteger('schema_version')->nullable();
            // The conversation as the chat sent it, untouched.
            $table->longText('payload');

            $table->unique(['owner_type', 'owner_id', 'conversation_id'], 'aparte_conversations_owner_unique');
            $table->index(['owner_type', 'owner_id', 'updated_ms'], 'aparte_conversations_owner_recent');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(config('aparte.conversations.table', 'aparte_conversations'));
    }
};
