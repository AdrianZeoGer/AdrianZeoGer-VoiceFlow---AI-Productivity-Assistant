#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{Manager, WindowEvent};

struct AppState {
    quitting: AtomicBool,
}

#[tauri::command]
fn get_clipboard_content() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

#[tauri::command]
fn inject_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    // Hide our window so the user's previous app receives the input.
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    std::thread::sleep(Duration::from_millis(150));

    // Prefer pasting via clipboard (more reliable than simulated typing for unicode / long text).
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let previous_clipboard = clipboard.get_text().ok();
    clipboard.set_text(text).map_err(|e| e.to_string())?;

    let mut enigo = enigo::Enigo::new(&enigo::Settings::default()).map_err(|e| e.to_string())?;

    use enigo::Direction::{Click, Press, Release};
    use enigo::{Key, Keyboard};

    #[cfg(target_os = "macos")]
    let paste_mod = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let paste_mod = Key::Control;

    enigo.key(paste_mod, Press);
    enigo.key(Key::Unicode('v'), Click);
    enigo.key(paste_mod, Release);

    // Restore clipboard best-effort so we don't disrupt the user.
    if let Some(prev) = previous_clipboard {
        std::thread::sleep(Duration::from_millis(100));
        let _ = clipboard.set_text(prev);
    }

    Ok(())
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let is_visible = win.is_visible().unwrap_or(false);
        if is_visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        }
    }
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let quit = MenuItem::with_id(app, "quit", "Quit VoiceFlow", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit])?;

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        // Right-click opens the menu; left-click toggles window visibility.
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                // Allow window close handlers to actually close while quitting.
                app.state::<AppState>().quitting.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });

    // Use the app icon for the tray icon when available.
    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}

#[cfg(desktop)]
fn setup_global_shortcut(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    // Note: modifier-only shortcuts (e.g. RShift+RCtrl) are not reliably supported across OSes.
    // We use Shift+Space as a stable global shortcut.
    let shift_space = Shortcut::new(Some(Modifiers::SHIFT), Code::Space);
    let to_register = Shortcut::new(Some(Modifiers::SHIFT), Code::Space);

    app.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app_handle, shortcut, event| {
                if shortcut == &shift_space && event.state() == ShortcutState::Pressed {
                    toggle_main_window(app_handle);
                }
            })
            .build(),
    )?;

    // Try to register the shortcut, but don't fail if it's already registered
    match app.global_shortcut().register(to_register) {
        Ok(_) => println!("Global shortcut Shift+Space registered successfully"),
        Err(e) => {
            eprintln!("Warning: Could not register global shortcut: {}. It may already be registered by another application.", e);
        }
    }
    
    Ok(())
}

#[cfg(not(desktop))]
fn setup_global_shortcut(_app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_clipboard_content, inject_text])
        .setup(|app| {
            app.manage(AppState {
                quitting: AtomicBool::new(false),
            });
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_autostart::init(
                        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                        None,
                    ),
                );
                setup_tray(&app.handle()).map_err(|e| e.to_string())?;
                setup_global_shortcut(&app.handle()).map_err(|e| e.to_string())?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // If we are quitting, allow the close to proceed.
                if window
                    .app_handle()
                    .state::<AppState>()
                    .quitting
                    .load(Ordering::SeqCst)
                {
                    return;
                }
                // Keep app running; hide window instead of quitting.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
