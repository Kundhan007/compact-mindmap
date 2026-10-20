// Mindmap desktop shell: a native window around the web UI. No server; files are served from the bundle.
mod store;
use serde_json::{json, Value};
use std::{borrow::Cow, cell::RefCell, fs, path::PathBuf};
use store::{data_dir, Store};
use tao::dpi::{LogicalSize, PhysicalPosition, PhysicalSize};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
use tao::window::WindowBuilder;
use wry::http::{Response, StatusCode};
use wry::WebViewBuilder;

enum Msg {
    Reply(String),
    Quit,
}

fn web_dir() -> PathBuf {
    if let Ok(p) = std::env::var("MM_WEB") {
        return PathBuf::from(p);
    }
    let live = data_dir().join("web"); // page code kept outside the signed app, so edits never change its signature
    if live.join("index.html").is_file() {
        return live;
    }
    let exe = std::env::current_exe().unwrap_or_default();
    exe.parent().and_then(|p| p.parent()).map(|p| p.join("Resources/web")).unwrap_or_default()
}

fn mime(p: &str) -> &'static str {
    match p.rsplit('.').next().unwrap_or("") {
        "html" => "text/html",
        "css" => "text/css",
        "js" => "text/javascript",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
}

fn serve(path: &str) -> Response<Cow<'static, [u8]>> {
    let rel = path.trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    let ok = !rel.split('/').any(|s| s == ".." || s.is_empty());
    match ok.then(|| fs::read(web_dir().join(rel)).ok()).flatten() {
        Some(b) => Response::builder().header("Content-Type", mime(rel)).body(Cow::Owned(b)).unwrap(),
        None => Response::builder().status(StatusCode::NOT_FOUND).body(Cow::Borrowed(&b""[..])).unwrap(),
    }
}

fn read_bounds() -> Option<(i32, i32, u32, u32)> {
    let t = fs::read_to_string(data_dir().join("window.txt")).ok()?;
    let v: Vec<i64> = t.split(',').filter_map(|x| x.trim().parse().ok()).collect();
    (v.len() == 4).then(|| (v[0] as i32, v[1] as i32, v[2] as u32, v[3] as u32))
}

fn main() {
    // test runs (MM_TEST_JS) are headless: no window, no Dock icon, no focus stealing
    let test = std::env::var("MM_TEST_JS").is_ok();
    let mut ev = EventLoopBuilder::<Msg>::with_user_event().build();
    if test {
        ev.set_activation_policy(ActivationPolicy::Accessory);
        ev.set_activate_ignoring_other_apps(false); // tao otherwise grabs focus on launch
    }
    let proxy = ev.create_proxy();
    let mut wb = WindowBuilder::new()
        .with_title("Mindmap")
        .with_visible(!test)
        .with_inner_size(LogicalSize::new(1440.0, 900.0))
        .with_min_inner_size(LogicalSize::new(600.0, 400.0));
    if let Some((x, y, w, h)) = read_bounds() {
        wb = wb.with_inner_size(PhysicalSize::new(w, h)).with_position(PhysicalPosition::new(x, y));
    }
    let window = wb.build(&ev).unwrap();
    menu();

    let store = RefCell::new(Store::load());
    let ipc_proxy = proxy.clone();
    let mut builder = WebViewBuilder::new()
        .with_background_color((20, 22, 26, 255))
        .with_custom_protocol("mm".into(), |_, req| serve(req.uri().path()))
        .with_navigation_handler(|u| u.starts_with("mm://"))
        .with_new_window_req_handler(|_, _| wry::NewWindowResponse::Deny)
        .with_ipc_handler(move |req| {
            let m: Value = serde_json::from_str(req.body()).unwrap_or_default();
            let id = m["id"].as_u64().unwrap_or(0);
            let (ok, v) = match m["op"].as_str().unwrap_or("") {
                "log" => {
                    println!("{}", m["t"].as_str().unwrap_or(""));
                    (true, Value::Null)
                }
                "quit" => {
                    let _ = ipc_proxy.send_event(Msg::Quit);
                    return;
                }
                op => match store.borrow_mut().call(op, &m) {
                    Ok(v) => (true, v),
                    Err(e) => (false, json!(e.to_string())),
                },
            };
            let _ = ipc_proxy.send_event(Msg::Reply(format!("window.__nfs({id},{ok},{v});")));
        })
        .with_url("mm://localhost/index.html");
    if let Some(t) = std::env::var("MM_TEST_JS").ok().and_then(|p| fs::read_to_string(p).ok()) {
        builder = builder.with_initialization_script(t);
    }
    let webview = builder.build(&window).unwrap();

    ev.run(move |event, _, flow| {
        *flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(Msg::Reply(js)) => { let _ = webview.evaluate_script(&js); }
            Event::UserEvent(Msg::Quit) => *flow = ControlFlow::Exit,
            Event::WindowEvent { event: WindowEvent::Resized(_) | WindowEvent::Moved(_), .. } => {
                if let (Ok(p), s) = (window.outer_position(), window.inner_size()) {
                    let _ = fs::create_dir_all(data_dir());
                    let b = format!("{},{},{},{}", p.x, p.y, s.width, s.height);
                    let _ = fs::write(data_dir().join("window.txt"), b);
                }
            }
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => *flow = ControlFlow::Exit,
            _ => {}
        }
    });
}

// Standard Mac menus so copy / paste / undo / quit work in the page
fn menu() {
    use muda::{Menu, PredefinedMenuItem as P, Submenu};
    let m = Menu::new();
    let app = Submenu::with_items(
        "Mindmap",
        true,
        &[
            &P::about(None, None),
            &P::separator(),
            &P::hide(None),
            &P::hide_others(None),
            &P::show_all(None),
            &P::separator(),
            &P::quit(None),
        ],
    )
    .unwrap();
    let edit = Submenu::with_items(
        "Edit",
        true,
        &[
            &P::undo(None),
            &P::redo(None),
            &P::separator(),
            &P::cut(None),
            &P::copy(None),
            &P::paste(None),
            &P::select_all(None),
        ],
    )
    .unwrap();
    let win = Submenu::with_items(
        "Window",
        true,
        &[&P::minimize(None), &P::maximize(None), &P::fullscreen(None), &P::close_window(None)],
    )
    .unwrap();
    m.append_items(&[&app, &edit, &win]).unwrap();
    m.init_for_nsapp();
    std::mem::forget(m);
}
