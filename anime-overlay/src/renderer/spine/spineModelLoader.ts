import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";
import { PhysicsConfig } from "./physics-config";
import { BonePhysics } from "./bonePhysics";

export class SpineModelLoader {
  private static readonly NIKKE_BASE = "https://nikke-db-legacy.pages.dev/l2d/";
  private static readonly DOTGG_BASE = "https://codeberg.org/alesha229/nikke/src/branch/main";
  
  public nikkeIndexData: any = null;
  public nikkie4IndexData: any = null;
  private loadToken = 0;

  /**
   * Load Nikke and Nikkie4 index files
   */
  async loadIndexes(): Promise<void> {
    // Load Nikke.json
    try {
      const nikkeResponse = await fetch("./Nikke.json");
      if (nikkeResponse.ok) {
        const nikkeData = await nikkeResponse.json();
        console.log("Loaded Nikke.json:", nikkeData);
        this.nikkeIndexData = nikkeData;
      } else {
        console.warn("Nikke.json not found, using minimal fallback");
        this.nikkeIndexData = { name: "root", children: [], files: [] };
      }
    } catch (e) {
      console.warn("Could not load Nikke.json:", e);
      this.nikkeIndexData = { name: "root", children: [], files: [] };
    }

    // Load nikkie4.2.json
    try {
      const nikkie4Response = await fetch("./nikkie4.2.json");
      if (nikkie4Response.ok) {
        const rawData = await nikkie4Response.json();
        console.log("Raw nikkie4.1.json:", rawData);

        if (Array.isArray(rawData) && rawData.length > 3 && rawData[3] && rawData[3].skins) {
          this.nikkie4IndexData = rawData[3];
          console.log("Using nikkie4 data from array[3]:", this.nikkie4IndexData);
        } else if (rawData && rawData.skins) {
          this.nikkie4IndexData = rawData;
          console.log("Using nikkie4 data as object:", this.nikkie4IndexData);
        } else {
          console.warn("Unexpected nikkie4.1.json format, using fallback");
          this.nikkie4IndexData = { skins: [] };
        }
      } else {
        console.warn("nikkie4.1.json not found, using minimal fallback");
        this.nikkie4IndexData = { skins: [] };
      }
    } catch (e) {
      console.warn("Could not load nikkie4.1.json:", e);
      this.nikkie4IndexData = { skins: [] };
    }
  }

  /**
   * Resolve a Nikke model by key from the index
   */
  resolveNikkeModel(
    indexRoot: any,
    key: string
  ): { atlasUrl: string; skelUrl: string } | null {
    if (!indexRoot || !key) return null;
    const lcKey = key.toLowerCase();
    let foundPath: string[] = [];
    let foundFiles: string[] = [];
    
    const dfs = (node: any, path: string[]) => {
      if (foundPath.length) return;
      const nodeName = (node.name || "").toLowerCase();
      const files: string[] = node.files || [];
      if (
        nodeName === lcKey ||
        files.some((f) => f.toLowerCase().includes(lcKey))
      ) {
        foundPath = path;
        foundFiles = files;
        return;
      }
      for (const child of node.children || [])
        dfs(child, path.concat(child.name));
    };
    
    dfs(indexRoot, []);
    if (!foundPath || foundPath.length === 0) return null;
    
    let base = SpineModelLoader.NIKKE_BASE + foundPath.join("/") + "/";
    if (foundPath[0] && (foundPath[0] as string).toLowerCase() === "dotgg") {
      base = SpineModelLoader.NIKKE_BASE + foundPath.slice(1).join("/") + "/";
    }
    
    const pick = (ext: string) => {
      const candidates = foundFiles.filter((f) =>
        f.toLowerCase().endsWith(ext)
      );
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.length - b.length);
      return base + candidates[0];
    };
    
    const atlasUrl = pick(".atlas");
    const skelUrl = pick(".skel");
    if (!atlasUrl || !skelUrl) return null;
    return { atlasUrl, skelUrl };
  }

  /**
   * Resolve a node by path in the index tree
   */
  resolveNodeByPath(indexRoot: any, parts: string[]) {
    const cleanedParts =
      parts && parts.length && parts[0] === "dotgg"
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

  /**
   * Pick model URLs from a node
   */
  pickModelFromNode(
    node: any,
    nikkePathParts: string[] | null
  ): { atlasUrl: string; skelUrl: string } | null {
    const files: string[] = node.files || [];
    if (!files.length) return null;
    
    let base =
      SpineModelLoader.NIKKE_BASE +
      (nikkePathParts ? nikkePathParts.join("/") + "/" : "");
    if (nikkePathParts && nikkePathParts[0] === "dotgg") {
      base = SpineModelLoader.DOTGG_BASE;
      const real = nikkePathParts.slice(1);
      if (real.length) base += real.join("/") + "/";
    }
    
    const pick = (ext: string) => {
      const candidates = files.filter((f) => f.toLowerCase().endsWith(ext));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.length - b.length);
      return base + candidates[0];
    };
    
    const atlasUrl = pick(".atlas");
    const skelUrl = pick(".skel");
    if (!atlasUrl || !skelUrl) return null;
    return { atlasUrl, skelUrl };
  }

  /**
   * Load a Spine model from URLs
   */
  async loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    scale: number,
    idle: string,
    modelName: string,
    isNikkie4Model: boolean = false,
    onSuccess: (spine: Spine, physicsConfig: PhysicsConfig, physicsBones: BonePhysics[]) => void,
    onError: (error: any) => void
  ): Promise<void> {
    const localToken = ++this.loadToken;

    try {
      PIXI.Assets.add({ alias: `spine-data-${localToken}`, src: skelUrl });
      const resource = await PIXI.Assets.load(`spine-data-${localToken}`);
      PIXI.Assets.setPreferences({ preferCreateImageBitmap: false });

      if (localToken !== this.loadToken) return;
      
      const spineboy = new Spine(resource.spineData);
      spineboy.x = 0;
      spineboy.y = 1000;
      spineboy.scale.set(scale);

      if (spineboy.state.hasAnimation(idle)) {
        spineboy.state.setAnimation(0, idle, true);
      }

      // Load physics configuration
      let physicsFile: string;

      if (isNikkie4Model) {
        const parts = modelName.split('/');
        let fileName = parts[parts.length - 1] || modelName;
        const nameParts = fileName.split('_');
        let typeIndex = -1;
        for (let i = 0; i < nameParts.length; i++) {
          const part = nameParts[i].toLowerCase();
          if (part === 'aim' || part === 'cover') {
            typeIndex = i;
            break;
          }
        }

        if (typeIndex !== -1) {
          nameParts.splice(typeIndex, 1);
          if (typeIndex > 0) {
            const previousPart = nameParts[typeIndex - 1];
            if (/^\d+$/.test(previousPart)) {
              nameParts.splice(typeIndex);
            }
          }
        }

        const cleanedName = nameParts.join('_');
        physicsFile = `${idle.includes('aim') ? 'aim' : idle.includes('cover') ? 'cover' : 'idle'}-physics-${cleanedName}.json`;
      } else {
        const type = modelName.includes("_cover_") ? "cover" : "aim";
        const base = modelName.replace(/_(aim|cover)_/, "_").replace(/^_+|_+$/g, '');
        physicsFile = `${type}-physics-${base}.json`;
      }

      console.log("Loading physics file:", physicsFile);
      const physicsConfig: PhysicsConfig = await fetch(
        'physics' + `/${physicsFile}`
      )
        .then((r) => r.json())
        .catch(() => ({} as PhysicsConfig));
      
      const physicsBoneNames = Object.keys(
        physicsConfig.BoneSpringPhysicsSettingCollection || {}
      );
      const allBoneNames = spineboy.skeleton.bones.map((bone) => bone.data.name);
      const matchingBones = allBoneNames.filter((boneName) =>
        physicsBoneNames.includes(boneName)
      );
      
      const globalSettings = {
        maxForce: 6000,
        maxSpeed: 3000,
        physicsStrengthMultiplier: 0.6,
      };
      
      const physicsBones: BonePhysics[] = [];
      for (const bone of spineboy.skeleton.bones) {
        const boneName = bone.data.name;
        if (physicsBoneNames.includes(boneName)) {
          const settings =
            physicsConfig.BoneSpringPhysicsSettingCollection[boneName];
          const bonePhysics = new BonePhysics(
            bone,
            settings,
            physicsConfig,
            globalSettings
          );
          physicsBones.push(bonePhysics);
          console.log(`[MODEL] Bone "${boneName}" added to physics.`);
        }
      }

      onSuccess(spineboy, physicsConfig, physicsBones);
    } catch (error) {
      console.error("Failed to load model:", error);
      console.error("URLs:", { skelUrl, atlasUrl });

      // Try alternative URL structure
      if (modelName.includes("_")) {
        const parts = modelName.split("_");
        if (parts.length >= 2) {
          const characterName = parts[0];
          const skinName = parts.slice(1).join("_");

          const baseUrl = "https://codeberg.org/alesha229/nikke/raw/branch/main";
          const altSkelUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${encodeURIComponent(skinName)}.skel`;
          const altAtlasUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${encodeURIComponent(skinName)}.atlas`;

          console.log("Trying alternative URLs:", { altSkelUrl, altAtlasUrl });

          try {
            PIXI.Assets.add({ alias: `spine-data-${localToken}`, src: altSkelUrl });
            const resource = await PIXI.Assets.load(`spine-data-${localToken}`);

            if (localToken !== this.loadToken) return;
            const spineboy = new Spine(resource.spineData);
            spineboy.x = 0;
            spineboy.y = 1000;
            spineboy.scale.set(scale);

            if (spineboy.state.hasAnimation(idle)) {
              spineboy.state.setAnimation(0, idle, true);
            }

            console.log("Successfully loaded from alternative location");
            onSuccess(spineboy, {} as PhysicsConfig, []);
            return;
          } catch (altError) {
            console.error("Alternative load failed:", altError);
          }
        }
      }

      onError(error);
    }
  }

  /**
   * Try to load model for a given path
   */
  async tryLoadModelForPath(
    parts: string[],
    currentRepo: "nikke" | "nikkie4",
    onSuccess: (
      skelUrl: string,
      atlasUrl: string,
      idle: string,
      modelName: string,
      isNikkie4: boolean
    ) => void
  ) {
    try {
      if (currentRepo === "nikkie4" || (parts && parts[0] === "dotgg")) {
        if (parts.length < 3) return;

        const characterName = parts[1];
        const skinName = parts[2];
        if (!characterName || !skinName) return;
        
        let subfolder = "";
        if (skinName.toLowerCase().includes("aim")) {
          subfolder = "aim/";
        } else if (skinName.toLowerCase().includes("cover")) {
          subfolder = "cover/";
        }
        
        const baseUrl = "https://codeberg.org/alesha229/nikke/raw/branch/main";
        const atlasUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${subfolder}${encodeURIComponent(skinName)}.atlas`;
        const skelUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${subfolder}${encodeURIComponent(skinName)}.skel`;

        const nameHint = skinName.toLowerCase();
        const idleAnim = nameHint.includes("aim")
          ? "aim_idle"
          : nameHint.includes("cover")
          ? "cover_idle"
          : "idle";

        onSuccess(skelUrl, atlasUrl, idleAnim, skinName, true);
        return;
      }
    } catch (e) {
      console.error("Error loading nikkie4 model:", e);
    }

    const indexData = this.nikkeIndexData;
    if (!indexData) return;

    const node = this.resolveNodeByPath(indexData, parts);
    const picked = node ? this.pickModelFromNode(node, parts) : null;
    if (!picked) return;

    const nameHint = (picked.skelUrl || picked.atlasUrl || "").toLowerCase();
    const idleAnim = nameHint.includes("aim")
      ? "aim_idle"
      : nameHint.includes("cover")
      ? "cover_idle"
      : "idle";

    let modelName = nameHint.split('/').pop()?.split('.').slice(0, -1).join('.') || '';
    onSuccess(picked.skelUrl, picked.atlasUrl, idleAnim, modelName, false);
  }

  /**
   * Get current load token
   */
  getCurrentLoadToken(): number {
    return this.loadToken;
  }

  /**
   * Cancel any pending loads
   */
  cancelPendingLoads(): void {
    this.loadToken++;
  }
}
