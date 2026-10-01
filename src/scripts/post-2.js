(function() {
    'use strict';

    // ---- DOM 引用 ----
    const fileInput1 = document.getElementById('fileInput1');
    const fileInput2 = document.getElementById('fileInput2');
    const fileCard1 = document.getElementById('fileCard1');
    const fileCard2 = document.getElementById('fileCard2');
    const fileInfo1 = document.getElementById('fileInfo1');
    const fileInfo2 = document.getElementById('fileInfo2');
    const parseInfo1 = document.getElementById('parseInfo1');
    const parseInfo2 = document.getElementById('parseInfo2');
    const geoInfo1 = document.getElementById('geoInfo1');
    const skinInfo1 = document.getElementById('skinInfo1');
    const geoInfo2 = document.getElementById('geoInfo2');
    const skinInfo2 = document.getElementById('skinInfo2');
    const parseBtn1 = document.getElementById('parseBtn1');
    const parseBtn2 = document.getElementById('parseBtn2');
    const mergeBtn = document.getElementById('mergeBtn');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const logBox = document.getElementById('logBox');
    const logCount = document.getElementById('logCount');
    const loadingWrapper = document.getElementById('loadingWrapper');

    // ---- 状态 ----
    let zipData1 = null; // { zip: JSZip, file: File, name: string, size: number }
    let zipData2 = null;
    let parsed1 = null; // { geo: {}, skins: [] }
    let parsed2 = null;
    let isProcessing = false;

    // ---- 工具函数 ----
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function getFileExtension(name) {
        return name.split('.').pop().toLowerCase();
    }

    function safeJsonParse(text) {
        try { return JSON.parse(text); } catch (_) { return null; }
    }

    // ---- 日志 ----
    function log(message, type) {
        type = type || 'info';
        const cls = 'log-' + type;
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.innerHTML = `<span style="color:var(--color-text-placeholder);">[${time}]</span> <span class="${cls}">${message}</span>`;
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
        // 更新计数
        const count = logBox.children.length;
        logCount.textContent = count + ' 条';
        return entry;
    }

    function clearLog() {
        logBox.innerHTML = '';
        logCount.textContent = '0 条';
        log('日志已清空', 'info');
    }

    // ---- 加载遮罩 ----
    // 注意：全屏遮罩在 578c964「改用 SPA」时已随 load-css.js 一并移除，
    // 页面上并不存在 #loadingWrapper。这里必须做空值保护，否则下面的
    // showLoading() 会抛 TypeError：解析按钮点了没反应，合并按钮更是会
    // 因为 disabled 已置位、finally 永不执行而永久卡死。
    function showLoading(show) {
        if (!loadingWrapper) return;
        loadingWrapper.classList.toggle('show', show);
    }

    // ---- 读取 ZIP 并解析基本信息 ----
    async function loadZipFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            return { zip, file, name: file.name, size: file.size };
        } catch (err) {
            log('读取 ZIP 失败: ' + err.message, 'error');
            return null;
        }
    }

    // ---- 从 ZIP 中提取 JSON ----
    async function extractJsonFromZip(zip, filename) {
        try {
            const fileObj = zip.file(filename);
            if (!fileObj) return null;
            const content = await fileObj.async('string');
            return safeJsonParse(content);
        } catch (_) {
            return null;
        }
    }

    // ---- 解析皮肤包（提取 geo 字段 & skins 列表） ----
    async function parseSkinPack(zipData) {
        if (!zipData) return null;
        const { zip } = zipData;
        const geoJson = await extractJsonFromZip(zip, 'geometry.json');
        const skinsJson = await extractJsonFromZip(zip, 'skins.json');

        const geoFields = {};
        if (geoJson) {
            for (const [key, value] of Object.entries(geoJson)) {
                if (key.startsWith('geometry.')) {
                    geoFields[key] = value;
                }
            }
        }

        let skinsList = [];
        if (skinsJson && Array.isArray(skinsJson.skins)) {
            skinsList = skinsJson.skins;
        }

        return { geoFields, skinsList, geoJson, skinsJson };
    }

    // ---- 更新文件卡片信息 ----
    function updateFileCard(index, file, parsed) {
        const card = index === 1 ? fileCard1 : fileCard2;
        const info = index === 1 ? fileInfo1 : fileInfo2;
        const parseInfo = index === 1 ? parseInfo1 : parseInfo2;
        const geoInfo = index === 1 ? geoInfo1 : geoInfo2;
        const skinInfo = index === 1 ? skinInfo1 : skinInfo2;

        if (file) {
            card.classList.add('has-file');
            info.innerHTML = `
                <span class="filename">${file.name}</span>
                <span class="file-size"> (${formatSize(file.size)})</span>
            `;
        } else {
            card.classList.remove('has-file');
            info.innerHTML = `<span style="color:var(--color-text-placeholder);">点击选择或拖拽 .zip</span>`;
            parseInfo.style.display = 'none';
            return;
        }

        if (parsed) {
            parseInfo.style.display = 'grid';
            const geoKeys = Object.keys(parsed.geoFields);
            geoInfo.textContent = geoKeys.length ? geoKeys.join('\n') : '（无）';
            const skinNames = parsed.skinsList.map(s => s.localization_name || '?');
            skinInfo.textContent = skinNames.length ? skinNames.join('\n') : '（无）';
        } else {
            parseInfo.style.display = 'none';
        }
    }

    // ---- 解析按钮处理 ----
    async function handleParse(index) {
        if (isProcessing) {
            log('正在处理中，请稍候…', 'warn');
            return;
        }

        const input = index === 1 ? fileInput1 : fileInput2;
        const file = input.files && input.files[0];
        if (!file) {
            log('请先选择一个 ZIP 文件', 'warn');
            return;
        }
        if (getFileExtension(file.name) !== 'zip') {
            log('请选择 .zip 格式的文件', 'error');
            return;
        }

        showLoading(true);
        try {
            const zipData = await loadZipFile(file);
            if (!zipData) {
                showLoading(false);
                return;
            }
            const parsed = await parseSkinPack(zipData);
            if (!parsed) {
                log('解析失败：未找到 geometry.json 或 skins.json', 'error');
                showLoading(false);
                return;
            }

            if (index === 1) {
                zipData1 = zipData;
                parsed1 = parsed;
                updateFileCard(1, file, parsed);
                log(`包1 解析完成：geometry ${Object.keys(parsed.geoFields).length} 个，皮肤 ${parsed.skinsList.length} 个`,
                    'success');
            } else {
                zipData2 = zipData;
                parsed2 = parsed;
                updateFileCard(2, file, parsed);
                log(`包2 解析完成：geometry ${Object.keys(parsed.geoFields).length} 个，皮肤 ${parsed.skinsList.length} 个`,
                    'success');
            }
        } catch (err) {
            log('解析出错: ' + err.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    // ---- 核心合并逻辑 ----
    async function performMerge() {
        if (isProcessing) {
            log('已有任务在处理中', 'warn');
            return;
        }
        if (!zipData1 || !zipData2) {
            log('请先解析两个皮肤包', 'warn');
            return;
        }
        if (!parsed1 || !parsed2) {
            log('请先解析两个皮肤包', 'warn');
            return;
        }

        const mode = document.querySelector('input[name="mergeMode"]:checked').value;
        log('开始合并，模式: ' + (mode === 'overwrite' ? '覆盖' : '共存'), 'info');

        isProcessing = true;
        mergeBtn.disabled = true;
        parseBtn1.disabled = true;
        parseBtn2.disabled = true;
        showLoading(true);

        try {
            // 1. 准备输出 ZIP
            const outZip = new JSZip();

            // 2. 复制包1的所有文件到输出
            const files1 = zipData1.zip.files;
            for (const [path, fileObj] of Object.entries(files1)) {
                if (fileObj.dir) continue;
                const content = await fileObj.async('uint8array');
                outZip.file(path, content);
            }

            // 3. 处理包2的文件（冲突时重命名图片）
            const renameMap = {}; // 原文件名 -> 新文件名
            const imageExts = ['.png', '.jpg', '.jpeg', '.tga', '.bmp', '.gif'];
            const files2 = zipData2.zip.files;

            for (const [path, fileObj] of Object.entries(files2)) {
                if (fileObj.dir) continue;
                if (path === 'geometry.json' || path === 'skins.json') continue;

                const baseName = path.split('/').pop();
                const ext = '.' + baseName.split('.').pop().toLowerCase();

                // 检查是否在输出中已存在
                if (outZip.file(path)) {
                    // 存在冲突
                    if (mode === 'coexist' && imageExts.includes(ext)) {
                        // 图片 → 重命名
                        const nameWithoutExt = baseName.slice(0, -ext.length);
                        let newName = nameWithoutExt + '_add' + ext;
                        let counter = 1;
                        while (outZip.file(path.replace(baseName, newName))) {
                            newName = nameWithoutExt + '_add_' + counter + ext;
                            counter++;
                        }
                        const newPath = path.replace(baseName, newName);
                        const content = await fileObj.async('uint8array');
                        outZip.file(newPath, content);
                        renameMap[baseName] = newName;
                        log(`图片重命名: ${baseName} → ${newName}`, 'info');
                    } else {
                        // 覆盖模式 或 非图片 → 跳过
                        log(`跳过重复文件: ${baseName} (${mode === 'overwrite' ? '覆盖模式' : '非图片'})`, 'warn');
                    }
                } else {
                    // 无冲突，直接复制
                    const content = await fileObj.async('uint8array');
                    outZip.file(path, content);
                }
            }

            // 4. 合并 geometry.json
            const geo1 = parsed1.geoJson || {};
            const geo2 = parsed2.geoJson || {};
            const mergedGeo = {};

            // 先放包1
            for (const [k, v] of Object.entries(geo1)) {
                mergedGeo[k] = v;
            }

            const geoRenameMap = {}; // 原始键 -> 新键（仅冲突时）
            // 再放包2
            for (const [k, v] of Object.entries(geo2)) {
                if (k.startsWith('geometry.')) {
                    if (mergedGeo.hasOwnProperty(k)) {
                        if (mode === 'coexist') {
                            let newKey = k + '_add';
                            let counter = 1;
                            while (mergedGeo.hasOwnProperty(newKey)) {
                                newKey = k + '_add_' + counter;
                                counter++;
                            }
                            mergedGeo[newKey] = v;
                            geoRenameMap[k] = newKey;
                            log(`几何键重命名: ${k} → ${newKey}`, 'info');
                        } else {
                            // 覆盖：保留包1
                            log(`几何键冲突 (覆盖): ${k} 保留包1`, 'warn');
                        }
                    } else {
                        mergedGeo[k] = v;
                    }
                } else {
                    // 非 geometry 字段，包2优先补充
                    if (!mergedGeo.hasOwnProperty(k)) {
                        mergedGeo[k] = v;
                    }
                }
            }

            // 5. 合并 skins.json
            const skins1 = parsed1.skinsList || [];
            const skins2 = parsed2.skinsList || [];
            const skinMap = {};

            // 先放包1
            for (const skin of skins1) {
                const name = skin.localization_name || 'unknown';
                skinMap[name] = skin;
            }

            const skinRenameMap = {};
            const existingNames = new Set(Object.keys(skinMap));

            for (const skin of skins2) {
                let name = skin.localization_name;
                if (!name) {
                    // 没有名字的皮肤，生成一个
                    name = 'skin_' + (Object.keys(skinMap).length + 1);
                }
                if (existingNames.has(name)) {
                    if (mode === 'coexist') {
                        let newName = name + '_add';
                        let counter = 1;
                        while (existingNames.has(newName)) {
                            newName = name + '_add_' + counter;
                            counter++;
                        }
                        const skinCopy = JSON.parse(JSON.stringify(skin));
                        skinCopy.localization_name = newName;

                        // 更新 geometry 引用
                        if (skinCopy.geometry && geoRenameMap[skinCopy.geometry]) {
                            skinCopy.geometry = geoRenameMap[skinCopy.geometry];
                            log(`更新皮肤 "${newName}" 的 geometry 引用: ${skin.geometry} → ${skinCopy.geometry}`,
                                'info');
                        }
                        // 更新 texture 引用
                        if (skinCopy.texture && renameMap[skinCopy.texture]) {
                            skinCopy.texture = renameMap[skinCopy.texture];
                            log(`更新皮肤 "${newName}" 的 texture 引用: ${skin.texture} → ${skinCopy.texture}`,
                                'info');
                        }

                        skinMap[newName] = skinCopy;
                        existingNames.add(newName);
                        log(`皮肤重命名: ${name} → ${newName}`, 'info');
                    } else {
                        // 覆盖：保留包1
                        log(`皮肤冲突 (覆盖): ${name} 保留包1`, 'warn');
                    }
                } else {
                    // 无冲突，直接放入
                    const skinCopy = JSON.parse(JSON.stringify(skin));
                    // 检查是否需要更新引用（包2的皮肤可能引用了被重命名的几何键）
                    if (skinCopy.geometry && geoRenameMap[skinCopy.geometry]) {
                        skinCopy.geometry = geoRenameMap[skinCopy.geometry];
                        log(`更新皮肤 "${name}" 的 geometry 引用: ${skin.geometry} → ${skinCopy.geometry}`, 'info');
                    }
                    if (skinCopy.texture && renameMap[skinCopy.texture]) {
                        skinCopy.texture = renameMap[skinCopy.texture];
                        log(`更新皮肤 "${name}" 的 texture 引用: ${skin.texture} → ${skinCopy.texture}`, 'info');
                    }
                    skinMap[name] = skinCopy;
                    existingNames.add(name);
                }
            }

            const mergedSkins = Object.values(skinMap);

            // 6. 构建最终的 skins.json
            const finalSkinsJson = {};
            if (parsed1.skinsJson) {
                for (const [k, v] of Object.entries(parsed1.skinsJson)) {
                    if (k !== 'skins') finalSkinsJson[k] = v;
                }
            }
            if (parsed2.skinsJson) {
                for (const [k, v] of Object.entries(parsed2.skinsJson)) {
                    if (k !== 'skins' && !finalSkinsJson.hasOwnProperty(k)) {
                        finalSkinsJson[k] = v;
                    }
                }
            }
            finalSkinsJson.skins = mergedSkins;

            // 7. 写回 JSON 文件（无缩进紧凑格式）
            const geoStr = JSON.stringify(mergedGeo);
            const skinStr = JSON.stringify(finalSkinsJson);

            if (outZip.file('geometry.json')) {
                outZip.remove('geometry.json');
            }
            if (outZip.file('skins.json')) {
                outZip.remove('skins.json');
            }
            outZip.file('geometry.json', geoStr);
            outZip.file('skins.json', skinStr);

            // 8. 生成并下载
            log('正在打包…', 'info');
            const blob = await outZip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `skin_merged_${timestamp}.zip`;
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 5000);

            log(`合并完成！下载: ${fileName} (${formatSize(blob.size)})`, 'success');

        } catch (err) {
            log('合并出错: ' + err.message + '\n' + (err.stack || ''), 'error');
            console.error(err);
        } finally {
            isProcessing = false;
            mergeBtn.disabled = false;
            parseBtn1.disabled = false;
            parseBtn2.disabled = false;
            showLoading(false);
        }
    }

    // ---- 拖拽支持 ----
    function setupDragDrop(card, input, index) {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.style.borderColor = 'var(--mc-green)';
            card.style.background = 'rgba(124,179,66,0.10)';
        });
        card.addEventListener('dragleave', () => {
            card.style.borderColor = '';
            card.style.background = '';
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.style.borderColor = '';
            card.style.background = '';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                input.files = files;
                input.dispatchEvent(new Event('change'));
            }
        });
        card.addEventListener('click', () => {
            input.click();
        });
        input.addEventListener('change', () => {
            if (input.files && input.files.length > 0) {
                handleParse(index);
            }
        });
    }

    // ---- 初始化 ----
    function init() {
        setupDragDrop(fileCard1, fileInput1, 1);
        setupDragDrop(fileCard2, fileInput2, 2);

        parseBtn1.addEventListener('click', () => handleParse(1));
        parseBtn2.addEventListener('click', () => handleParse(2));
        mergeBtn.addEventListener('click', performMerge);
        clearLogBtn.addEventListener('click', clearLog);

        // 初始日志
        log('就绪，请选择两个皮肤包 ZIP 文件。', 'info');
        log('提示：先解析两个包，再点击「开始合并」', 'info');

        // 快捷键：Ctrl+Enter 触发合并
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                performMerge();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();