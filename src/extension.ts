/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/// <reference types="vscode" />
import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as cowsay from "cowsay";

let overlayChildProcess: cp.ChildProcess | null = null;

// Keep a reference to overlay events path to signal shutdown on IDE close
let overlayEventsPathGlobal: string | null = null;

class AnimeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "animeView";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = getAnimeHtml(
      this._extensionUri,
      webviewView.webview
    );
  }

  // _getHtmlForWebview moved to shared getAnimeHtml function below
}

function getWebviewHtml(webview: vscode.Webview): string {
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
  try {
    const overlayDir = path.join(context.extensionPath, "anime-overlay");
    const eventsPath = path.join(overlayDir, "events.json");
    // ensure events file exists
    fs.promises
      .writeFile(eventsPath, JSON.stringify({ type: "init", timestamp: Date.now() }))
      .catch(() => {});

    const writeEvent = async (ev: any) => {
      try {
        await fs.promises.writeFile(eventsPath, JSON.stringify(ev));
      } catch (e) {
        console.error("Failed to write overlay event", e);
      }
    };

    // track which files were modified since last save
    const modifiedSinceSave = new Set<string>();

    subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        try {
          const p = doc.uri.fsPath;
          if (modifiedSinceSave.has(p)) {
            writeEvent({ type: "save", path: p, timestamp: Date.now() });
            modifiedSinceSave.delete(p);
          } else {
            // do not emit save if file wasn't changed since last save
            console.debug("save ignored (no changes):", p);
          }
        } catch (e) {
          console.error("onDidSaveTextDocument handler error", e);
        }
      })
    );

    // throttle edits to avoid flooding
    let lastEditAt = 0;
    subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        try {
          const now = Date.now();
          // mark file as modified since last save
          if (e && e.document && e.document.uri && e.document.uri.fsPath) modifiedSinceSave.add(e.document.uri.fsPath);
          if (now - lastEditAt < 2000) return; // 2s debounce
          lastEditAt = now;
          writeEvent({ type: "edit", path: e.document.uri.fsPath, timestamp: now });
        } catch (err) {
          console.error('onDidChangeTextDocument error', err);
        }
      })
    );

    subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document)
          writeEvent({ type: "focus", path: editor.document.uri.fsPath, timestamp: Date.now() });
      })
    );
  } catch (e) {
    console.error("Failed to setup overlay events bridge", e);
  }

  
})();

      </script>
    </body>
  </html>`;
}

function getAnimeHtml(extensionUri: vscode.Uri, webview: vscode.Webview) {
  const nonce = Date.now().toString();
  return `<!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        :root { --bg:#1e1e1e; color: #ddd }
        body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family: sans-serif }
        .container { display:flex; height:100vh; align-items:flex-end; justify-content:flex-end }
        .model-wrap { width:240px; height:320px; margin:8px }
        .controls { position:absolute; left:8px; top:8px; color:#ccc }
      </style>
    </head>
    <body>
      <div class="controls">Панель Live2D — модель справа внизу</div>
      <div class="container">
        <div class="model-wrap" id="live2d"></div>
      </div>
      <script nonce="${nonce}">
        // Minimal Live2D setup using pixi-live2d-display (CDN)
        function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
        (async()=>{
          try{
            await loadScript('https://cdn.jsdelivr.net/npm/pixi.js@6.5.8/dist/browser/pixi.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@1.2.4/dist/pixi-live2d-display.js');
            const app = new PIXI.Application({ transparent: true, width: 240, height: 320 });
            document.getElementById('live2d').appendChild(app.view);
            const modelUrl = 'https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/%E5%B0%91%E5%A5%B3%E5%89%8D%E7%BA%BF%20girls%20Frontline/live2dnew/mk23_8/destroy/destroy.model3.json';
            const model = await PIXI.live2d.Live2DModel.from(modelUrl);
            model.scale.set(0.5);
            model.x = app.renderer.width - model.width/2;
            model.y = app.renderer.height - model.height/2;
            app.stage.addChild(model);
          }catch(e){
            const el=document.createElement('div');el.style.color='red';el.textContent='Ошибка загрузки модели';document.body.appendChild(el);
          }
        })();
      </script>
    </body>
    </html>`;
}

export function activate(context: vscode.ExtensionContext) {
  const subscriptions = context.subscriptions;
  try {
    overlayEventsPathGlobal = path.join(
      context.extensionPath,
      "anime-overlay",
      "events.json"
    );
  } catch {}

  // register a content provider for the cowsay-scheme
  const myScheme = "cowsay";
  const myProvider = new (class implements vscode.TextDocumentContentProvider {
    // emitter and its event
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
      // simply invoke cowsay, use uri-path as text
      return cowsay.say({ text: uri.path });
    }
  })();
  subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(myScheme, myProvider)
  );

  // register the Anime view provider (panel)
  const provider = new AnimeViewProvider(context.extensionUri);
  subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnimeViewProvider.viewType,
      provider
    )
  );

  // командa для показа внешнего окна с моделью (Electron overlay)
  subscriptions.push(
    vscode.commands.registerCommand("anime.show", async () => {
      const overlayPath = path.join(context.extensionPath, "anime-overlay");
      // path to events file used for simple IPC between extension and overlay
      const eventsPath = path.join(overlayPath, "events.json");
      const pkgPath = path.join(overlayPath, "package.json");
      const exists = await fs.promises
        .stat(pkgPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        vscode.window.showErrorMessage(
          'anime-overlay не найден. Убедитесь, что папка "anime-overlay" присутствует в расширении.'
        );
        return;
      }

      const runCmd = (command: string) =>
        new Promise<{
          ok: boolean;
          stdout: string;
          stderr: string;
          error?: any;
        }>((resolve) => {
          // copy env and remove ELECTRON_RUN_AS_NODE which VS Code can set
          const env = Object.assign({}, process.env) as any;
          if (env.ELECTRON_RUN_AS_NODE) delete env.ELECTRON_RUN_AS_NODE;
          try {
            env.VSCODE_PARENT_PID = String(process.pid);
          } catch {}

          cp.exec(
            command,
            { cwd: overlayPath, windowsHide: true, env },
            (error, stdout, stderr) => {
              resolve({
                ok: !error,
                stdout: stdout?.toString() || "",
                stderr: stderr?.toString() || "",
                error,
              });
            }
          );
        });

      vscode.window.showInformationMessage(
        "Пробую запустить overlay через npx electron ..."
      );
      // Убедимся, что зависимости установлены (node_modules). Если нет — запустим `npm install`.
      const nodeModulesPath = path.join(overlayPath, "node_modules");
      const hasNodeModules = await fs.promises
        .stat(nodeModulesPath)
        .then(() => true)
        .catch(() => false);
      if (!hasNodeModules) {
        const installOk = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Устанавливаю зависимости для anime-overlay...",
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Запуск npm install..." });
            const resInstall = await runCmd("npm install");
            if (!resInstall.ok) {
              console.error("[anime.show] npm install failed:", resInstall);
              vscode.window.showErrorMessage(
                "Не удалось установить зависимости для anime-overlay. Посмотрите консоль расширения для деталей."
              );
              return false;
            }
            return true;
          }
        );

        if (!installOk) {
          return;
        }
      }
      // If already running, don't start another
      if (overlayChildProcess && !overlayChildProcess.killed) {
        vscode.window.showInformationMessage("Overlay уже запущен.");
        return;
      }

      const trySpawn = (cmd: string, args: string[]) => {
        return new Promise<boolean>((resolve) => {
          try {
            const env = Object.assign({}, process.env) as any;
            if (env.ELECTRON_RUN_AS_NODE) delete env.ELECTRON_RUN_AS_NODE;
            env.VSCODE_PARENT_PID = String(process.pid);
            const child = cp.spawn(cmd, args, {
              cwd: overlayPath,
              windowsHide: true,
              shell: true,
              env,
              stdio: "ignore",
            });
            overlayChildProcess = child;
            const onExit = () => {
              try {
                overlayChildProcess = null;
              } catch {}
            };
            child.once("exit", onExit);
            child.once("error", onExit);
            // Assume started if no immediate error; resolve true after small delay
            setTimeout(() => resolve(true), 200);
          } catch (e) {
            resolve(false);
          }
        });
      };

      // Prefer spawn with npx electron . to keep a handle for later termination
      const spawned = await trySpawn("npx", ["electron", "."]);
      if (spawned) return;

      vscode.window.showInformationMessage(
        "npx electron не сработал — пробую npm run start ..."
      );
      // Fallback: spawn npm run start
      const spawnedNpm = await trySpawn("npm", ["run", "start"]);
      if (spawnedNpm) return;

      vscode.window.showErrorMessage(
        "Не удалось автоматически запустить overlay. Смотрите консоль расширения для деталей."
      );
      // Also clear handle just in case
      try {
        overlayChildProcess = null;
      } catch {}
    })
  );

  // Simple coding -> overlay bridge: write small JSON event to anime-overlay/events.json
  try {
    const overlayDir = path.join(context.extensionPath, "anime-overlay");
    const eventsPath = path.join(overlayDir, "events.json");
    try {
      overlayEventsPathGlobal = eventsPath;
    } catch {}
    // ensure events file exists
    fs.promises
      .writeFile(
        eventsPath,
        JSON.stringify({ type: "init", timestamp: Date.now() })
      )
      .catch(() => {});

    const writeEvent = async (ev: any) => {
      try {
        await fs.promises.writeFile(eventsPath, JSON.stringify(ev));
      } catch (e) {
        console.error("Failed to write overlay event", e);
      }
    };

    // track file changes and number of characters added since last save
    const stateByFile = new Map<
      string,
      { charsAdded: number; modified: boolean }
    >();

    function accumulateChange(docPath: string, delta: number) {
      if (!stateByFile.has(docPath))
        stateByFile.set(docPath, { charsAdded: 0, modified: false });
      const st = stateByFile.get(docPath)!;
      if (delta > 0) st.charsAdded += delta;
      if (delta !== 0) st.modified = true;
    }

    // edits: accumulate character deltas and emit light 'edit' events (debounced)
    let lastEditAt = 0;
    // caret updates (debounced) — emit caret position as line/character
    let lastCaretAt = 0;
    subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        try {
          const now = Date.now();
          const p = e.document.uri.fsPath;
          // compute delta chars from contentChanges
          let delta = 0;
          for (const ch of e.contentChanges) {
            const added = (ch.text || "").length;
            const removed =
              typeof ch.rangeLength === "number" ? ch.rangeLength : 0;
            delta += added - removed;
          }
          accumulateChange(p, delta);

          if (now - lastEditAt < 1000) return; // debounce 1s for edit event
          lastEditAt = now;
          writeEvent({ type: "edit", path: p, timestamp: now, delta });
        } catch (err) {
          console.error("onDidChangeTextDocument error", err);
        }
      })
    );

    subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        try {
          const now = Date.now();
          // debounce frequent cursor moves
          if (now - lastCaretAt < 100) return;
          lastCaretAt = now;
          const editor = e.textEditor;
          if (!editor || !editor.document) return;
          const pos =
            (e.selections && e.selections[0] && e.selections[0].active) || null;
          if (!pos) return;
          // include visible range and font size to help overlay map caret -> screen
          const vr = (editor.visibleRanges && editor.visibleRanges[0]) || null;
          const visibleStart = vr ? vr.start.line : pos.line;
          const visibleEnd = vr ? vr.end.line : pos.line;
          const cfg = vscode.workspace.getConfiguration(
            "editor",
            editor.document.uri
          );
          const fontSize = Number(cfg.get("fontSize") || 14);
          writeEvent({
            type: "caret",
            path: editor.document.uri.fsPath,
            line: pos.line,
            character: pos.character,
            visibleStart,
            visibleEnd,
            fontSize,
            timestamp: now,
          });
        } catch (err) {
          console.error("onDidChangeTextEditorSelection error", err);
        }
      })
    );

    // save: only emit save event if the file was modified since last save; include charsAdded
    subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        try {
          const p = doc.uri.fsPath;
          const st = stateByFile.get(p) || { charsAdded: 0, modified: false };
          if (st.modified && st.charsAdded > 0) {
            writeEvent({
              type: "save",
              path: p,
              timestamp: Date.now(),
              chars: st.charsAdded,
            });
          } else if (st.modified && st.charsAdded === 0) {
            // modified but no net added chars (e.g., edits that didn't change length) - still emit small save
            writeEvent({
              type: "save",
              path: p,
              timestamp: Date.now(),
              chars: 0,
            });
          } else {
            // nothing changed since last save — ignore
            // console.debug('save ignored (no changes):', p);
          }
          // reset tracking for this file
          stateByFile.delete(p);
        } catch (e) {
          console.error("onDidSaveTextDocument handler error", e);
        }
      })
    );

    subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document)
          writeEvent({
            type: "focus",
            path: editor.document.uri.fsPath,
            timestamp: Date.now(),
          });
      })
    );
  } catch (e) {
    console.error("Failed to setup overlay events bridge", e);
  }

  // Webview автозапуск убран — используем только Electron overlay через команду `anime.show`
}

export async function deactivate() {
  try {
    const p = overlayEventsPathGlobal;
    if (!p) return;
    const payload = {
      type: "shutdown",
      timestamp: Date.now(),
    } as any;
    await fs.promises.writeFile(p, JSON.stringify(payload));
  } catch (e) {
    try {
      console.error("Failed to write shutdown event", e);
    } catch {}
  }
  try {
    if (overlayChildProcess && !overlayChildProcess.killed) {
      try {
        overlayChildProcess.kill();
      } catch {}
    }
  } catch {}
}
