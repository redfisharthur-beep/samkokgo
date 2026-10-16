extends "res://scripts/visual_main.gd"

func _handle_lobby_click(pos: Vector2) -> void:
	var size := get_viewport_rect().size
	var center := size * 0.5
	# Match the hit areas to the exact button rectangles drawn by visual_main.gd.
	if Rect2(center + Vector2(-180.0, -70.0), Vector2(360.0, 58.0)).has_point(pos):
		network.quick_join()
		status_text = "正在尋找隊友…"
	elif Rect2(center + Vector2(-180.0, 2.0), Vector2(360.0, 58.0)).has_point(pos):
		network.create_room()
		status_text = "正在建立房間…"
	elif Rect2(center + Vector2(-130.0, 82.0), Vector2(260.0, 54.0)).has_point(pos):
		if room_connected and not is_host:
			status_text = "等候房主開始"
		else:
			if room_connected:
				network.send_action({"type": "start"})
			_start_battle(false)
	queue_redraw()
