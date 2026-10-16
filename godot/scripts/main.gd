extends Control

@onready var network: CloudflareRoom = $CloudflareRoom
var status_label: Label
var rooms_label: Label
var room_label: Label
var is_connected_to_room := false

func _ready() -> void:
	_build_interface()
	network.api_result.connect(_on_api_result)
	network.room_event.connect(_on_room_event)
	network.connection_changed.connect(_on_connection_changed)
	network.list_rooms()

func _build_interface() -> void:
	var background := ColorRect.new()
	background.color = Color("#3d4742")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(620, 390)
	center.add_child(panel)

	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 18)
	panel.add_child(stack)

	var title := Label.new()
	title.text = "三國倖存者 · Godot 4 連線驗證"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	stack.add_child(title)

	status_label = Label.new()
	status_label.text = "正在讀取房間…"
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(status_label)

	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.add_child(buttons)
	_add_button(buttons, "快速加入", func() -> void: network.quick_join())
	_add_button(buttons, "建立公開房", func() -> void: network.create_room())
	_add_button(buttons, "重新整理", func() -> void: network.list_rooms())

	room_label = Label.new()
	room_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(room_label)

	rooms_label = Label.new()
	rooms_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rooms_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stack.add_child(rooms_label)

	var leave_button := Button.new()
	leave_button.text = "離開房間"
	leave_button.custom_minimum_size = Vector2(180, 48)
	leave_button.pressed.connect(func() -> void:
		network.leave_room()
		is_connected_to_room = false
		status_label.text = "已離開房間"
		room_label.text = ""
	)
	stack.add_child(leave_button)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stack.add_child(spacer)

	var note := Label.new()
	note.text = "此分支先驗證 Godot 與既有 Cloudflare 房間服務；角色模型與戰鬥場景尚未移植。"
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stack.add_child(note)

func _add_button(parent: HBoxContainer, caption: String, action: Callable) -> void:
	var button := Button.new()
	button.text = caption
	button.custom_minimum_size = Vector2(165, 50)
	button.pressed.connect(action)
	parent.add_child(button)

func _on_api_result(endpoint: String, payload: Dictionary) -> void:
	if payload.has("error"):
		status_label.text = "連線服務回應錯誤：" + str(payload["error"])
		return
	match endpoint:
		"/api/rooms":
			var rooms: Array = payload.get("rooms", [])
			if rooms.is_empty():
				rooms_label.text = "目前沒有可加入的公開房"
			else:
				rooms_label.text = "可加入房間：%s" % rooms.size()
		"/api/create", "/api/quick-join":
			var target := str(payload.get("roomId", ""))
			if not target.is_empty():
				network.join_room(target)
				room_label.text = "房間：" + target

func _on_room_event(payload: Dictionary) -> void:
	if payload.get("type") == "presence":
		var snapshot: Dictionary = payload.get("snapshot", {})
		var players: Array = snapshot.get("players", [])
		status_label.text = "房間已連線 · %s 位玩家" % players.size()
	elif payload.get("type") == "start":
		status_label.text = "收到開局訊號 · 下一步接入 Godot 戰鬥場景"

func _on_connection_changed(state: String) -> void:
	is_connected_to_room = state == "connected"
	if state == "connecting":
		status_label.text = "正在連線到房間…"
	elif state == "connected":
		status_label.text = "房間已連線 · 等待其他玩家"
	elif state.begins_with("error:"):
		status_label.text = "WebSocket 連線失敗：" + state

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		network.leave_room()
