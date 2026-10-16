extends Node
class_name CloudflareRoom

signal api_result(endpoint: String, payload: Dictionary)
signal room_event(payload: Dictionary)
signal connection_changed(state: String)

@export var worker_base_url: String = ""

var socket := WebSocketPeer.new()
var room_id: String = ""
var self_id: String = ""
var resume_token: String = ""

func _process(_delta: float) -> void:
	socket.poll()
	var state := socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		while socket.get_available_packet_count() > 0:
			var packet := socket.get_packet()
			var parsed: Variant = JSON.parse_string(packet.get_string_from_utf8())
			if parsed is Dictionary:
				_handle_message(parsed)
	elif state == WebSocketPeer.STATE_CLOSED:
		pass

func list_rooms() -> void:
	_request_api("/api/rooms", HTTPClient.METHOD_GET, {})

func create_room() -> void:
	_request_api("/api/create", HTTPClient.METHOD_POST, {})

func quick_join() -> void:
	_request_api("/api/quick-join", HTTPClient.METHOD_POST, {})

func join_room(target_room_id: String, hero_id: String = "liubei") -> void:
	room_id = target_room_id.to_upper()
	if socket.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		socket.close()
	socket = WebSocketPeer.new()
	var url := _websocket_base_url() + "/ws?room=" + room_id.uri_encode() + "&hero=" + hero_id.uri_encode()
	if not resume_token.is_empty():
		url += "&resume=" + resume_token.uri_encode()
	var error := socket.connect_to_url(url)
	if error != OK:
		connection_changed.emit("error:%s" % error)
	else:
		connection_changed.emit("connecting")

func send_input(x: float, z: float, px: float, pz: float) -> void:
	_send({
		"type": "input",
		"x": clampf(x, -1.0, 1.0),
		"z": clampf(z, -1.0, 1.0),
		"px": px,
		"pz": pz
	})

func send_game_state(state: Dictionary) -> void:
	_send({"type": "game-state", "state": state})

func send_action(message: Dictionary) -> void:
	_send(message)

func leave_room() -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.close(1000, "left")
	room_id = ""

func _handle_message(message: Dictionary) -> void:
	var kind := str(message.get("type", ""))
	if kind == "welcome":
		self_id = str(message.get("selfId", ""))
		resume_token = str(message.get("resumeToken", ""))
		connection_changed.emit("connected")
		room_event.emit(message)
	elif kind in ["presence", "players", "room", "start", "game-state", "attack-fx", "enemy-shot-fx", "ability", "level-choice", "player-attack"]:
		room_event.emit(message)

func _send(message: Dictionary) -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(message))

func _request_api(path: String, method: int, payload: Dictionary) -> void:
	var request := HTTPRequest.new()
	add_child(request)
	request.request_completed.connect(
		func(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
			var parsed: Variant = JSON.parse_string(body.get_string_from_utf8())
			if parsed is Dictionary:
				api_result.emit(path, parsed)
			else:
				api_result.emit(path, {"error": "HTTP %s" % response_code})
			request.queue_free(),
		CONNECT_ONE_SHOT
	)
	var headers := PackedStringArray()
	var body := ""
	if method != HTTPClient.METHOD_GET:
		headers.append("Content-Type: application/json")
		body = JSON.stringify(payload)
	var error := request.request(_base_url() + path, headers, method, body)
	if error != OK:
		api_result.emit(path, {"error": "Request error %s" % error})
		request.queue_free()

func _base_url() -> String:
	if not worker_base_url.strip_edges().is_empty():
		return worker_base_url.strip_edges().trim_suffix("/")
	if OS.has_feature("web"):
		return str(JavaScriptBridge.eval("window.location.origin"))
	return "http://127.0.0.1:8787"

func _websocket_base_url() -> String:
	return _base_url().replace("https://", "wss://").replace("http://", "ws://")
