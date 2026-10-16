extends SceneTree
## CI smoke test: instantiate the actual atlas-based scene and verify
## all pixel sprites, frames and isometric TileMapLayer assets load in Godot 4.3.

func _initialize() -> void:
	call_deferred("_verify")

func _verify() -> void:
	var actor_resource: PackedScene = load("res://scenes/battle/pixel_actor.tscn")
	var world_resource: PackedScene = load("res://scenes/battle/pixel_world.tscn")
	if actor_resource == null or world_resource == null:
		push_error("Pixel scenes missing")
		quit(1)
		return
	var avatar: Node2D = actor_resource.instantiate()
	root.add_child(avatar)
	for kind in ["liubei", "caocao", "sunquan", "lvbu", "grunt", "runner", "archer", "boss"]:
		avatar.call("configure", "smoke", kind)
		var animated: AnimatedSprite2D = avatar.get_node("PixelAnimator")
		if animated.sprite_frames == null or animated.sprite_frames.get_animation_names().size() != 6:
			push_error("Bad animation atlas for " + kind)
			quit(1)
			return
		for animation in animated.sprite_frames.get_animation_names():
			if animated.sprite_frames.get_frame_count(animation) != 4:
				push_error("Missing sprite frames in " + kind + " / " + animation)
				quit(1)
				return
	avatar.call("set_visual_position", Vector2(120, 80), 0.016, true)
	avatar.call("play_attack")
	var world: Node2D = world_resource.instantiate()
	root.add_child(world)
	var ground: TileMapLayer = world.get_node("Ground")
	if ground.tile_set == null or ground.get_used_cells().size() < 300:
		push_error("Isometric tilemap is empty")
		quit(1)
		return
	var depth: Node2D = world.get_node("Depth")
	if not depth.y_sort_enabled or depth.get_child_count() < 20:
		push_error("Depth props / Y-sort missing")
		quit(1)
		return
	print("PIXEL ART SMOKE PASS: 8 actor atlases, 6 action/facing rows, 4 frames each, isometric tilemap and depth props.")
	world.queue_free()
	avatar.queue_free()
	quit(0)
