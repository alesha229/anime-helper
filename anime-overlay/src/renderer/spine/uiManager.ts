 export class UIManager {
    private demo: any;
    private uiToggleButton: HTMLElement | null = null;
    
    constructor(demo: any) {
        this.demo = demo;
    }
    
    public addUiToggleButton(): void {
        try {
            const existing = document.getElementById("overlay-ui-toggle");
            if (existing) {
                this.uiToggleButton = existing;
                return;
            }
            const btn = document.createElement("button");
            btn.id = "overlay-ui-toggle";
            btn.textContent = "Hide UI";
            btn.style.position = "absolute";
            btn.style.left = "12px";
            btn.style.bottom = "12px";
            btn.style.zIndex = "100000";
            btn.style.padding = "12px 18px";
            btn.style.fontSize = "16px";
            btn.style.minWidth = "140px";
            btn.style.height = "48px";
            btn.style.background = "rgba(0,0,0,0.7)";
            btn.style.color = "#fff";
            btn.style.border = "none";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";
            btn.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
            btn.onclick = () => {
                this.demo.isUiHidden = !this.demo.isUiHidden;
                if (this.demo.isUiHidden) {
                    btn.textContent = "Show UI";
                    const el = document.getElementById("head-controls");
                    if (el) el.style.display = "none";
                    const nik = document.getElementById("nikke-browser");
                    if (nik) nik.style.display = "none";
                    try {
                        (window as any).overlayAPI?.toggleClickThrough?.(true);
                        this.demo.clickThroughEnabled = true;
                    } catch {}
                } else {
                    btn.textContent = "Hide UI";
                    const el = document.getElementById("head-controls");
                    if (el) el.style.display = "block";
                    const nik = document.getElementById("nikke-browser");
                    if (nik) nik.style.display = "block";
                    try {
                        (window as any).overlayAPI?.toggleClickThrough?.(false);
                        this.demo.clickThroughEnabled = false;
                    } catch {}
                }
            };
            document.body.appendChild(btn);
            this.uiToggleButton = btn;
        } catch {}
    }
    
    public renderNikkeBrowser(): void {
        const existing = document.getElementById("nikke-browser");
        if (existing) existing.remove();
        const container = document.createElement("div");
        container.id = "nikke-browser";
        container.style.position = "absolute";
        container.style.top = "8px";
        container.style.left = "8px";
        container.style.background = "rgba(0,0,0,0.8)";
        container.style.color = "#fff";
        container.style.padding = "12px";
        container.style.borderRadius = "8px";
        container.style.maxWidth = "300px";
        container.style.maxHeight = "900px";
        container.style.overflow = "auto";
        container.style.fontSize = "14px";
        container.style.zIndex = "1000";
        
        // Repo selector
        const repoWrap = document.createElement("div");
        repoWrap.style.marginBottom = "8px";
        const sel = document.createElement("select");
        sel.style.background = "#333";
        sel.style.color = "#fff";
        sel.style.border = "1px solid #666";
        sel.style.padding = "4px";
        const opt1 = document.createElement("option");
        opt1.value = "nikke";
        opt1.textContent = "Nikke.json";
        const opt2 = document.createElement("option");
        opt2.value = "nikkie4";
        opt2.textContent = "nikkie4.1.json";
        sel.appendChild(opt1);
        sel.appendChild(opt2);
        sel.value = this.demo.currentRepo;
        sel.onchange = () => {
            this.demo.currentRepo = sel.value as any;
            this.demo.nikkePathParts = null;
            this.demo.n4ExpandedCharacter = null;
            this.renderNikkeBrowser();
        };
        repoWrap.appendChild(sel);
        container.appendChild(repoWrap);
        
        // File list
        const list = document.createElement("div");
        list.className = "nikke-file-list";
        if (this.demo.currentRepo === "nikke") {
            const indexData = this.demo.nikkeIndexData;
            if (!indexData) {
                const msg = document.createElement("div");
                msg.textContent = "Nikke index not loaded";
                list.appendChild(msg);
            } else {
                this.renderNikkeFileList(list, indexData);
            }
        } else {
            const n4 = this.demo.nikkie4IndexData;
            if (!n4) {
                const msg = document.createElement("div");
                msg.textContent = "nikkie4 index not loaded";
                list.appendChild(msg);
            } else {
                this.renderNikkie4FileList(list, n4);
            }
        }
        container.appendChild(list);
        document.body.appendChild(container);
    }
    
    private renderNikkeFileList(list: HTMLElement, indexData: any): void {
        const node = this.demo.nikkePathParts && this.demo.nikkePathParts.length
            ? this.resolveNodeByPath(indexData, this.demo.nikkePathParts) || null
            : indexData;
        
        // Breadcrumbs
        const crumbs = document.createElement("div");
        crumbs.style.marginBottom = "8px";
        const rootCrumb = document.createElement("a");
        rootCrumb.textContent = "/";
        rootCrumb.style.color = "#4a9eff";
        rootCrumb.style.cursor = "pointer";
        rootCrumb.onclick = (e) => {
            e.preventDefault();
            this.demo.nikkePathParts = null;
            this.renderNikkeBrowser();
        };
        crumbs.appendChild(rootCrumb);
        const parts = this.demo.nikkePathParts || [];
        parts.forEach((part: string, idx: number) => {
            crumbs.appendChild(document.createTextNode(" / "));
            const c = document.createElement("a");
            c.textContent = part;
            c.style.color = "#4a9eff";
            c.style.cursor = "pointer";
            c.onclick = (e) => {
                e.preventDefault();
                this.demo.nikkePathParts = parts.slice(0, idx + 1);
                this.renderNikkeBrowser();
            };
            crumbs.appendChild(c);
        });
        list.appendChild(crumbs);
        
        // Up one level
        if (this.demo.nikkePathParts && this.demo.nikkePathParts.length) {
            const upRow = document.createElement("div");
            upRow.style.padding = "4px";
            upRow.style.cursor = "pointer";
            upRow.style.borderRadius = "4px";
            upRow.innerHTML = '<span style="margin-right: 8px;">⬆️</span>..';
            upRow.onmouseover = () => (upRow.style.background = "rgba(255,255,255,0.1)");
            upRow.onmouseout = () => (upRow.style.background = "");
            upRow.onclick = () => {
                this.demo.nikkePathParts = this.demo.nikkePathParts!.slice(0, -1);
                this.renderNikkeBrowser();
            };
            list.appendChild(upRow);
        }
        
        // Children directories
        for (const child of node?.children || []) {
            const row = document.createElement("div");
            row.style.padding = "4px";
            row.style.cursor = "pointer";
            row.style.borderRadius = "4px";
            row.innerHTML = '<span style="margin-right: 8px;">📁</span>' + child.name;
            row.onmouseover = () => (row.style.background = "rgba(255,255,255,0.1)");
            row.onmouseout = () => (row.style.background = "");
            row.onclick = () => {
                this.demo.nikkePathParts = [...(this.demo.nikkePathParts || []), child.name];
                this.renderNikkeBrowser();
            };
            list.appendChild(row);
        }
        
        // Files
        const files: string[] = node?.files || [];
        const modelFiles = files.filter((f) => f.endsWith(".skel") || f.endsWith(".atlas"));
        for (const f of modelFiles) {
            const row = document.createElement("div");
            row.style.padding = "4px";
            row.style.borderRadius = "4px";
            const icon = f.endsWith(".skel") ? "🦴" : "🗎";
            row.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${f}`;
            list.appendChild(row);
        }
        
        if (modelFiles.length) {
            const loadBtn = document.createElement("button");
            loadBtn.textContent = "Load Model from This Folder";
            loadBtn.style.marginTop = "8px";
            loadBtn.style.padding = "8px 12px";
            loadBtn.style.background = "#4a9eff";
            loadBtn.style.color = "#fff";
            loadBtn.style.border = "none";
            loadBtn.style.borderRadius = "4px";
            loadBtn.style.cursor = "pointer";
            loadBtn.onclick = () => {
                this.demo.tryLoadModelForPath(this.demo.nikkePathParts || []);
            };
            list.appendChild(loadBtn);
        }
    }
    
    private renderNikkie4FileList(list: HTMLElement, n4: any): void {
        let src: any = n4;
        if (!n4.skins && Array.isArray(n4)) {
            const found = n4.find((x: any) => x && x.skins && Array.isArray(x.skins));
            if (found) src = found;
        }
        
        for (const ch of src.skins || []) {
            const row = document.createElement('div');
            row.style.padding = '4px';
            row.style.cursor = 'pointer';
            row.style.borderRadius = '4px';
            
            // Создаем контейнер для иконки
            const iconContainer = document.createElement('span');
            iconContainer.style.marginRight = '8px';
            iconContainer.style.display = 'inline-block';
            iconContainer.style.width = '155px';
            iconContainer.style.height = '201px';
            iconContainer.style.textAlign = 'center';
            iconContainer.style.verticalAlign = 'middle';
            
            // Добавляем плейсхолдер (значок 👤)
            iconContainer.textContent = '👤';
            
            // Создаем элемент для изображения
            const img = document.createElement('img');
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.display = 'none';
            img.style.objectFit = 'contain';
            
            // Формируем URL для thumbnail
            const thumbnailUrl = `https://gitea.com/alesha332/yohoho/raw/branch/main/${encodeURIComponent(ch.name)}/thumbnail.png`;
            
            // Загружаем изображение
            img.onload = () => {
                iconContainer.textContent = '';
                iconContainer.appendChild(img);
                img.style.display = 'block';
            };
            
            img.onerror = () => {
                console.log(`Failed to load thumbnail for ${ch.name}`);
            };
            
            img.src = thumbnailUrl;
            
            // Добавляем контейнер иконки и имя персонажа в строку
            row.appendChild(iconContainer);
            row.appendChild(document.createTextNode(ch.name));
            
            const skinContainer = document.createElement('div');
            skinContainer.style.display = this.demo.n4ExpandedCharacter === ch.name ? 'block' : 'none';
            
            for (const s of ch.skins || []) {
                const skinRow = document.createElement('div');
                skinRow.style.padding = '4px 4px 4px 22px';
                skinRow.style.cursor = 'pointer';
                skinRow.style.borderRadius = '4px';
                skinRow.innerHTML = `<span style="margin-right: 8px;">📁</span>${s.name} (${s.skin})`;
                
                skinRow.onmouseover = () => (skinRow.style.background = 'rgba(255,255,255,0.1)');
                skinRow.onmouseout = () => (skinRow.style.background = '');
                
                skinRow.onclick = () => {
                    this.demo.nikkePathParts = ["dotgg", ch.name, s.skin];
                    this.demo.tryLoadModelForPath(this.demo.nikkePathParts);
                };
                
                skinContainer.appendChild(skinRow);
            }
            
            row.onmouseover = () => (row.style.background = 'rgba(255,255,255,0.1)');
            row.onmouseout = () => (row.style.background = '');
            
            row.onclick = () => {
                const open = skinContainer.style.display === 'block';
                skinContainer.style.display = open ? 'none' : 'block';
                this.demo.n4ExpandedCharacter = open ? null : ch.name;
            };
            
            list.appendChild(row);
            list.appendChild(skinContainer);
        }
    }
    
    public renderHeadControls(): void {
        const existing = document.getElementById("head-controls");
        if (existing) existing.remove();
        const wrap = document.createElement("div");
        wrap.id = "head-controls";
        wrap.style.position = "absolute";
        wrap.style.top = "8px";
        wrap.style.right = "8px";
        wrap.style.background = "rgba(0,0,0,0.8)";
        wrap.style.color = "#fff";
        wrap.style.padding = "12px";
        wrap.style.font = "12px/1.4 monospace";
        wrap.style.borderRadius = "8px";
        wrap.style.zIndex = "1000";
        wrap.style.minWidth = "240px";
        const title = document.createElement("div");
        title.textContent = "Head Controls";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "8px";
        wrap.appendChild(title);
        
        // Create control sliders
        this.addSlider(wrap, "Nodes from head", this.demo.chainLength, 1, 5, 1, (val: number) => {
            this.demo.chainLength = val;
        });
        
        this.addSlider(wrap, "Rotation scale", this.demo.maxTurnScale, 0, 2, 0.05, (val: number) => {
            this.demo.maxTurnScale = val;
        });
        
        this.addSlider(wrap, "Parallax scale", this.demo.parallaxScale, 0, 10, 0.05, (val: number) => {
            this.demo.parallaxScale = val;
        });
        
        this.addSlider(wrap, "Bend scale", this.demo.headBendScale, 0, 2, 0.05, (val: number) => {
            this.demo.headBendScale = val;
        });
        
        this.addSlider(wrap, "Eye parallax", this.demo.eyeParallaxScale, 0, 10, 0.1, (val: number) => {
            this.demo.eyeParallaxScale = val;
        });
        
        this.addSlider(wrap, "Parallax time (ms)", this.demo.parallaxLagSeconds * 1000, 50, 1000, 10, (val: number) => {
            this.demo.parallaxLagSeconds = val / 1000;
        });
        
        this.addSlider(wrap, "Rotation time (ms)", this.demo.rotationLagSeconds * 1000, 50, 1000, 10, (val: number) => {
            this.demo.rotationLagSeconds = val / 1000;
        });
        
        this.addSlider(wrap, "Zoom", this.demo.cameraZoom, 0.1, 3, 0.05, (val: number) => {
            this.demo.cameraZoom = val;
            this.demo.userAdjustedZoom = true;
            this.demo.holder.scale.set(this.demo.cameraZoom);
            this.demo.holder.x = this.demo.app.screen.width / 2;
            this.demo.holder.y = this.demo.app.screen.height / 2;
        });
        
        document.body.appendChild(wrap);
    }
    
    private addSlider(
        parent: HTMLElement,
        label: string,
        value: number,
        min: number,
        max: number,
        step: number,
        onChange: (value: number) => void
    ): void {
        const container = document.createElement("div");
        container.style.marginBottom = "8px";
        const labelEl = document.createElement("label");
        labelEl.textContent = `${label}: ${value.toFixed(2)}`;
        labelEl.style.display = "block";
        labelEl.style.marginBottom = "4px";
        container.appendChild(labelEl);
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.value = String(value);
        slider.style.width = "200px";
        slider.style.accentColor = "#4a9eff";
        slider.addEventListener("input", () => {
            const newValue = parseFloat(slider.value);
            onChange(newValue);
            labelEl.textContent = `${label}: ${newValue.toFixed(2)}`;
        });
        container.appendChild(slider);
        parent.appendChild(container);
    }
    
    private resolveNodeByPath(indexRoot: any, parts: string[]): any {
        const cleanedParts = parts && parts.length && parts[0] === "dotgg"
            ? parts.slice(1)
            : parts || [];
        const lower = cleanedParts.map((p) => p.toLowerCase());
        let node = indexRoot;
        for (const part of lower) {
            const next = (node.children || []).find(
                (c: any) => (c.name || "").toLowerCase() === part
            );
            if (!next) return null;
            node = next;
        }
        return node;
    }
}