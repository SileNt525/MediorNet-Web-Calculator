// js/uiController.js

// --- 确保没有 import 或 export 语句 (因为是非模块化) ---

class UIController {
    // --- 构造函数: 获取 DOM 元素引用 ---
    constructor(networkManager) {
        console.log("UIController constructor called."); // 添加日志
        this.networkManager = networkManager;

        // 获取 DOM 元素引用
        this.deviceTypeSelect = document.getElementById('device-type');
        this.deviceNameInput = document.getElementById('device-name');
        this.portInputsContainer = document.getElementById('port-inputs');
        this.addDeviceBtn = document.getElementById('add-device-btn');
        this.deviceTableBody = document.getElementById('device-table-body');
        this.removeDeviceBtn = document.getElementById('remove-device-btn');
        this.clearDevicesBtn = document.getElementById('clear-devices-btn');
        this.portTotalsLabel = document.getElementById('port-totals');
        this.deviceFilterInput = document.getElementById('device-filter');
        this.calculateBtn = document.getElementById('calculate-btn');
        this.fillMeshBtn = document.getElementById('fill-mesh-btn');
        this.fillRingBtn = document.getElementById('fill-ring-btn');
        this.clearConnectionsBtn = document.getElementById('clear-connections-btn');
        this.connectionsOutput = document.getElementById('connections-output'); // 获取连接输出区域
        this.cy = null; // 添加用于存储 Cytoscape 实例的属性
        this.topologyLayout = 'Spring'; // 存储当前布局模式
        this.nodePositions = {}; // 存储节点位置 { nodeId: { x: number, y: number } }
        this.layoutCombo = document.getElementById('layout-mode'); // 获取布局下拉框

        console.log("UIController constructor called.");

        // 确认元素获取
        if (!this.deviceTypeSelect) console.error("Element not found: device-type");
        if (!this.addDeviceBtn) console.error("Element not found: add-device-btn");
        // ... 可以为所有重要元素添加检查 ...

        this.selectedDeviceIds = new Set();
    }

    // --- 初始化方法: 填充下拉框、绑定事件 ---
    initialize() {
        console.log("UIController initialize method started."); // 添加日志
        this.populateDeviceTypes();
        this.updatePortInputs();
        this._updateDeviceTable();
        this._updatePortTotalsDisplay();
        this._updateButtonStates();

        // --- 事件监听 ---
        this.deviceTypeSelect.addEventListener('change', () => this.updatePortInputs());
        this.addDeviceBtn.addEventListener('click', () => this.addDevice());
        this.clearDevicesBtn.addEventListener('click', () => this.clearAllDevices());
        this.removeDeviceBtn.addEventListener('click', () => this.removeSelectedDevices());
        this.deviceFilterInput.addEventListener('input', () => this.filterDeviceTable());

        // 计算和填充按钮事件
        this.calculateBtn.addEventListener('click', () => this.calculateAndDisplay());
        this.clearConnectionsBtn.addEventListener('click', () => this.clearResults());
        this.fillMeshBtn.addEventListener('click', () => this.fillRemainingMesh());
        this.fillRingBtn.addEventListener('click', () => this.fillRemainingRing());


        // 表格行点击事件 (事件委托)
        this.deviceTableBody.addEventListener('click', (event) => {
            const row = event.target.closest('tr');
            if (row && row.dataset.deviceId) {
                const deviceId = parseInt(row.dataset.deviceId, 10);
                if (this.selectedDeviceIds.has(deviceId)) {
                    this.selectedDeviceIds.delete(deviceId);
                    row.classList.remove('bg-blue-100');
                } else {
                    this.selectedDeviceIds.add(deviceId);
                    row.classList.add('bg-blue-100');
                }
                this._updateButtonStates();
            }
        });

         // 添加双击事件监听 (用于显示详情)
         this.deviceTableBody.addEventListener('dblclick', (event) => {
            const row = event.target.closest('tr');
            if (row && row.dataset.deviceId) {
                const deviceId = parseInt(row.dataset.deviceId, 10);
                this.showDeviceDetails(deviceId);
            }
        });
        // --- 添加 Cytoscape 初始化 ---
        this.initializeCytoscape();
        // --------------------------

        // --- 事件监听 ---
        // ... (之前的事件监听) ...
        // 监听布局选择变化
        this.layoutCombo.addEventListener('change', (event) => {
            this.topologyLayout = event.target.value; // 更新布局模式
            this.nodePositions = {}; // 切换布局时通常重置位置
            this.updateTopologyGraph(); // 使用新布局重新绘制
        });

        console.log("UI Controller Initialized method finished.");

    }

    // --- 新增：初始化 Cytoscape ---
    initializeCytoscape() {
        try {
             this.cy = cytoscape({
                 container: document.getElementById('cy'), // 绘图容器
                 elements: [], // 初始为空
                 style: [ // 定义样式
                     {
                         selector: 'node',
                         style: {
                             'background-color': '#ccc', // 默认颜色
                             'label': 'data(label)', // 显示节点标签
                             'text-valign': 'bottom',
                             'text-halign': 'center',
                             'font-size': '9px',
                             'text-wrap': 'wrap', // 允许多行标签
                             'text-max-width': '80px',
                             'height': 40, // 固定大小或根据数据调整
                             'width': 60,
                             'shape': 'rectangle' // 默认为矩形
                         }
                     },
                     // 为不同设备类型定义样式
                      {
                          selector: 'node[deviceType = "' + DEV_UHD + '"]', // 使用全局常量
                          style: { 'background-color': 'skyblue' }
                      },
                      {
                          selector: 'node[deviceType = "' + DEV_HORIZON + '"]',
                          style: { 'background-color': 'lightcoral' }
                      },
                      {
                         selector: 'node[deviceType = "' + DEV_MN + '"]',
                         style: { 'background-color': 'lightgreen' }
                      },
                      {
                          selector: 'node:selected', // 选中节点的样式
                          style: {
                              'border-width': 3,
                              'border-color': 'black'
                          }
                      },
                      {
                          selector: 'edge',
                          style: {
                              'width': 1.5,
                              'line-color': '#999', // 默认边颜色
                              'target-arrow-shape': 'none', // 无箭头
                              'curve-style': 'bezier', // 曲线样式
                              'label': 'data(label)', // 显示边标签
                              'font-size': '7px',
                              'text-rotation': 'autorotate',
                              'text-background-color': 'white', // 标签背景
                              'text-background-opacity': 0.7,
                              'text-background-padding': '1px'
                          }
                      },
                      // 为不同连接类型定义样式 (使用 class)
                      {
                          selector: 'edge[styleClass = "lc-lc-edge"]',
                          style: { 'line-color': 'blue', 'width': 2 }
                      },
                       {
                          selector: 'edge[styleClass = "mpo-mpo-edge"]',
                          style: { 'line-color': 'red', 'width': 2 }
                      },
                      {
                          selector: 'edge[styleClass = "mpo-sfp-edge"]',
                          style: { 'line-color': 'orange', 'width': 2 }
                      },
                       {
                          selector: 'edge[styleClass = "sfp-sfp-edge"]',
                          style: { 'line-color': 'purple', 'width': 2 }
                      }
                 ],
                 layout: {
                     name: 'grid' // 初始布局，会被 updateTopologyGraph 覆盖
                 },
                 // --- 交互选项 ---
                 zoomingEnabled: true,
                 userZoomingEnabled: true,
                 panningEnabled: true,
                 userPanningEnabled: true,
                 boxSelectionEnabled: true, // 允许多选
             });
             console.log("Cytoscape instance created.");

             // --- 添加 Cytoscape 事件监听 (为后续交互做准备) ---
              this.cy.on('tap', 'node', (event) => {
                 const node = event.target;
                 console.log(`Node tapped: ${node.id()} - ${node.data('label')}`);
                 // 实现单选逻辑
                 this.cy.nodes().unselect(); // 取消所有选择
                 node.select(); // 选中当前点击的
                  // TODO: 高亮逻辑 (后续实现)
             });
              this.cy.on('tap', (event) => {
                  // 点击背景取消选择
                  if(event.target === this.cy) {
                      this.cy.elements().unselect();
                      console.log("Tapped background - selection cleared.");
                       // TODO: 取消高亮 (后续实现)
                  }
              });

              // 节点拖拽结束事件 (用于保存位置)
              this.cy.on('dragfreeon', 'node', (event) => {
                  const node = event.target;
                  this.nodePositions[node.id()] = node.position(); // 保存节点位置
                  console.log(`Node ${node.id()} position saved:`, this.nodePositions[node.id()]);
              });

              // 双击事件 (显示详情)
              this.cy.on('dbltap', 'node', (event) => {
                  const node = event.target;
                  const deviceId = parseInt(node.id(), 10);
                  this.showDeviceDetails(deviceId);
              });

              // TODO: 添加 shift+拖拽 连接的事件监听 (后续实现)

        } catch (error) {
            console.error("Failed to initialize Cytoscape:", error);
            const cyContainer = document.getElementById('cy');
            if(cyContainer) cyContainer.innerHTML = '<p style="color: red; text-align: center; padding-top: 20px;">拓扑图加载失败，请检查控制台。</p>';
        }
    }

    // --- 新增：更新拓扑图 ---
    updateTopologyGraph() {
        if (!this.cy) {
            console.error("Cytoscape instance is not available.");
            return;
        }
        console.log(`Updating topology graph with layout: ${this.topologyLayout}`);
        const topologyData = this.networkManager.getTopologyData();

         // 保存当前缩放和平移状态
         const currentZoom = this.cy.zoom();
         const currentPan = this.cy.pan();

        // 更新元素 (移除旧的，添加新的)
        this.cy.elements().remove();
        this.cy.add(topologyData);

        // 应用布局
        let layoutOptions = {
            name: this.topologyLayout.toLowerCase() || 'cose', // 默认用 cose 效果较好
            animate: false, // 禁用动画以提高性能
            fit: false, // 不要自动缩放以适应视图，保留用户缩放
            padding: 30
        };

        // 为特定布局调整参数 (可以根据需要添加)
        if (layoutOptions.name === 'cose') {
            layoutOptions.idealEdgeLength = 100;
            layoutOptions.nodeOverlap = 20;
        } else if (layoutOptions.name === 'circle' || layoutOptions.name === 'concentric') {
            layoutOptions.avoidOverlap = true;
        } else if (layoutOptions.name === 'grid') {
            layoutOptions.avoidOverlap = true;
            layoutOptions.rows = Math.ceil(Math.sqrt(this.cy.nodes().length));
        } else if (layoutOptions.name === 'spring') { // NetworkX Spring 映射到 CoSE 或 fcose
             layoutOptions.name = 'cose';
             layoutOptions.randomize = true;
        } else if (layoutOptions.name === 'kamada-kawai') { // NetworkX Kamada-Kawai 映射到 cise (可能需要扩展) 或 cola
             layoutOptions.name = 'cola'; // Cola 通常效果更好
             layoutOptions.idealEdgeLength = 100;
        } else if (layoutOptions.name === 'random') {
            layoutOptions.name = 'random';
        } else if (layoutOptions.name === 'shell') {
              layoutOptions.name = 'concentric'; // 用同心圆模拟 Shell
              layoutOptions.concentric = (node) => {
                  // 简单的分层逻辑 (可以根据设备类型改进)
                  const type = node.data('deviceType');
                  if (UHD_TYPES.includes(type)) return 1;
                  if (type === DEV_MN) return 2;
                  return 3;
              };
              layoutOptions.levelWidth = (nodes) => 1;
              layoutOptions.minNodeSpacing = 50;
        }


        // 如果有保存的位置，并且布局不是 'random' 或 'grid' 等强制覆盖位置的布局
        const positionsToLoad = {};
        let useSavedPositions = !['random', 'grid'].includes(layoutOptions.name); // Circle/Concentric 也可能覆盖
         if(useSavedPositions && Object.keys(this.nodePositions).length > 0) {
             this.cy.nodes().forEach(node => {
                 if (this.nodePositions[node.id()]) {
                     positionsToLoad[node.id()] = this.nodePositions[node.id()];
                 } else {
                     useSavedPositions = false; // 如果有节点没有保存位置，则不用保存的位置
                 }
             });
         } else {
             useSavedPositions = false;
         }


        if (useSavedPositions && Object.keys(positionsToLoad).length > 0) {
            console.log("Applying saved node positions.");
            layoutOptions = { name: 'preset', positions: positionsToLoad, fit: false, zoom: currentZoom, pan: currentPan };
        } else {
            console.log(`Running layout: ${layoutOptions.name}`);
            this.nodePositions = {}; // 清空旧位置，因为是新布局
        }


        const layout = this.cy.layout(layoutOptions);
         layout.on('layoutstop', () => {
             // 布局结束后，如果不是 preset 布局，保存新位置
             if (layoutOptions.name !== 'preset') {
                  this.cy.nodes().forEach(node => {
                     this.nodePositions[node.id()] = node.position();
                 });
                 console.log("New positions saved after layout.");
                  // 恢复之前的缩放和平移
                  this.cy.zoom(currentZoom);
                  this.cy.pan(currentPan);
             }
              // 确保图形居中（可以根据需要调整）
              // this.cy.fit(undefined, 30); // 留30像素边距
         });

        layout.run(); // 执行布局

        console.log("Topology graph updated.");
    }

    // --- 设备类型和端口输入 ---
    populateDeviceTypes() {
        // 使用全局变量 (因为是非模块化)
        const deviceTypes = [DEV_UHD, DEV_HORIZON, DEV_MN];
        this.deviceTypeSelect.innerHTML = ''; // 清空现有选项
        deviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            this.deviceTypeSelect.appendChild(option);
        });
    }

    updatePortInputs() {
        const selectedType = this.deviceTypeSelect.value;
        this.portInputsContainer.innerHTML = '';

        const createInput = (id, label, defaultValue) => {
            const div = document.createElement('div');
            div.className = 'port-input-group';
            div.innerHTML = `
                <label for="${id}" class="block text-sm font-medium text-gray-700">${label}:</label>
                <input type="number" id="${id}" value="${defaultValue}" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm p-1">
            `;
            this.portInputsContainer.appendChild(div);
        };

        // 使用全局变量
        if (UHD_TYPES.includes(selectedType)) {
            createInput('mpo-ports', `${PORT_MPO} 端口`, '2');
            createInput('lc-ports', `${PORT_LC} 端口`, '2');
        } else if (selectedType === DEV_MN) {
            createInput('sfp-ports', `${PORT_SFP}+ 端口`, '8');
        }
    }

    // --- 设备管理方法 ---
    addDevice() {
        const type = this.deviceTypeSelect.value;
        const name = this.deviceNameInput.value.trim();

        if (!name) { alert("请输入设备名称。"); return; }

        let mpoPorts = 0, lcPorts = 0, sfpPorts = 0;
        let validPorts = true;

        try {
            if (UHD_TYPES.includes(type)) {
                mpoPorts = parseInt(document.getElementById('mpo-ports')?.value || '0', 10);
                lcPorts = parseInt(document.getElementById('lc-ports')?.value || '0', 10);
                if (isNaN(mpoPorts) || mpoPorts < 0 || isNaN(lcPorts) || lcPorts < 0) validPorts = false;
            } else if (type === DEV_MN) {
                sfpPorts = parseInt(document.getElementById('sfp-ports')?.value || '0', 10);
                 if (isNaN(sfpPorts) || sfpPorts < 0) validPorts = false;
            }
        } catch (e) { validPorts = false; }

        if (!validPorts) { alert("端口数量必须是非负整数。"); return; }

        const newDevice = this.networkManager.addDevice(name, type, mpoPorts, lcPorts, sfpPorts);

        if (newDevice) {
            this.deviceNameInput.value = '';
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates();
            this.updateTopologyGraph(); // 更新拓扑图
        }
    }

    removeSelectedDevices() {
        if (this.selectedDeviceIds.size === 0) { alert("请先选择要移除的设备。"); return; }
        const confirmed = confirm(`确定要移除选中的 ${this.selectedDeviceIds.size} 个设备吗？`);
        if (confirmed) {
            let removedCount = 0;
            this.selectedDeviceIds.forEach(id => {
                if (this.networkManager.removeDevice(id)) {
                    removedCount++;
                }        
            });
            console.log(`移除了 ${removedCount} 个设备。`);
            this.selectedDeviceIds.clear();
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates();
        }
        if (removedCount > 0) {
            // ... (更新表格和总数) ...
            this.nodePositions = {}; // 移除设备后重置布局位置
            this.updateTopologyGraph(); // 移除设备后更新图
        }
    }

    clearAllDevices() {
         if (this.networkManager.getAllDevices().length === 0) return;
        const confirmed = confirm("确定要清空所有设备和连接吗？");
        if (confirmed) {
            this.networkManager.clearAllDevicesAndConnections();
            this.selectedDeviceIds.clear();
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates();
            this.clearResultsDisplay();
            this.nodePositions = {}; // 清空设备后重置布局位置
            this.updateTopologyGraph(); // 清空设备后更新图
        }
    }

    // --- UI 更新方法 ---
    _updateDeviceTable() {
         this.deviceTableBody.innerHTML = '';
         const devices = this.networkManager.getAllDevices();

         if (devices.length === 0) {
             const row = this.deviceTableBody.insertRow();
             const cell = row.insertCell();
             cell.colSpan = 7;
             cell.textContent = '无设备';
             cell.className = 'text-center text-gray-500 py-4';
         } else {
              devices.forEach(dev => {
                 const row = this.deviceTableBody.insertRow();
                 row.dataset.deviceId = dev.id;
                 if (this.selectedDeviceIds.has(dev.id)) {
                     row.classList.add('bg-blue-100');
                 }
                 row.insertCell().textContent = dev.name;
                 row.insertCell().textContent = dev.type;
                 row.insertCell().textContent = dev.mpoTotal;
                 row.insertCell().textContent = dev.lcTotal;
                 row.insertCell().textContent = dev.sfpTotal;
                 row.insertCell().textContent = dev.getConnectionsFormatted(); // 使用 .getConnectionsFormatted()
                 const actionCell = row.insertCell();
                 actionCell.className = 'text-center';
                  // 添加双击事件监听 (临时性，因为行是动态创建的，事件委托更好，但这里先简单处理)
                  // 注意：如果行很多，这种方式效率不高。之前的事件委托方式更好。
                  // row.addEventListener('dblclick', () => this.showDeviceDetails(dev.id));

                  // 样式设置
                  row.cells[2].className = 'text-center';
                  row.cells[3].className = 'text-center';
                  row.cells[4].className = 'text-center';
                  row.cells[5].className = 'text-center';
             });
         }
          this.filterDeviceTable();
    }

    _updatePortTotalsDisplay() {
          const totals = this.networkManager.calculatePortTotals();
          this.portTotalsLabel.textContent = `总计: ${PORT_MPO}: ${totals.mpo}, ${PORT_LC}: ${totals.lc}, ${PORT_SFP}+: ${totals.sfp}`;
    }

    _updateButtonStates() {
          const hasDevices = this.networkManager.getAllDevices().length > 0;
          const hasSelection = this.selectedDeviceIds.size > 0;
          const hasConnections = this.networkManager.getAllConnections().length > 0;

          this.clearDevicesBtn.disabled = !hasDevices;
          this.removeDeviceBtn.disabled = !hasSelection;
          this.calculateBtn.disabled = !hasDevices;
          this.clearConnectionsBtn.disabled = !hasConnections;

          // 填充按钮逻辑
          let canFillAnyPort = false;
          if (hasDevices) {
              canFillAnyPort = this.networkManager.getAllDevices().some(dev => dev.getAllAvailablePorts().length > 0);
          }
          const canFill = hasConnections || canFillAnyPort; // 有连接或有设备且有空闲端口

          this.fillMeshBtn.disabled = !canFill;
          this.fillRingBtn.disabled = !canFill;
    }

    // --- 计算与结果显示 ---
    calculateAndDisplay() {
        const devices = this.networkManager.getAllDevices();
        if (devices.length === 0) { alert("请先添加设备。"); return; }

        this.networkManager.clearConnections();
        this._updateDeviceTable(); // 更新连接数列为 0

        const mode = document.getElementById('topology-mode').value;
        let calculatedConnections = [];
        let errorMessage = null;

        console.log(`开始计算 ${mode} 连接...`); // 添加日志

        if (mode === "Mesh") {
            calculatedConnections = this.networkManager.calculate_mesh();
        } else if (mode === "环形") {
            [calculatedConnections, errorMessage] = this.networkManager.calculate_ring();
        } else {
             alert(`未知的计算模式: ${mode}`); return;
        }

        if (errorMessage) { alert(`${mode} 计算警告: ${errorMessage}`); }

        let addedCount = 0;
        if (calculatedConnections && calculatedConnections.length > 0) {
             console.log(`计算得到 ${calculatedConnections.length} 条连接，尝试添加到管理器...`);
              calculatedConnections.forEach(connData => {
                  if (connData && connData.length === 5) {
                     if (this.networkManager.add_connection(connData[0].id, connData[1], connData[2].id, connData[3])) {
                         addedCount++;
                     } else {
                         console.warn(`警告: 添加计算出的连接 ${connData[0].name}[${connData[1]}]<->${connData[2].name}[${connData[3]}] 时失败。`);
                     }
                  } else {
                      console.warn("calculate_ 函数返回了无效的连接数据:", connData);
                  }
              });
              console.log(`成功添加了 ${addedCount} 条计算出的连接到管理器。`);
          } else {
              console.log("计算未产生任何连接（或功能未实现）。");
              if (addedCount === 0 && calculatedConnections.length === 0 && !errorMessage) {
                 // 如果计算函数确实没返回任何连接，可以给用户一个提示
                 alert(`${mode} 模式下未计算出任何连接。`);
              }
                      // ... (计算连接并添加到 networkManager) ...
        if (addedCount > 0 || calculatedConnections.length === 0) { // 即使没添加也要更新图（移除旧边）
            this.nodePositions = {}; // 计算后重新布局
            this.updateTopologyGraph(); // 计算后更新图
       }
       // ... (更新连接列表和按钮) ...
          }

        this.displayConnections();
        this._updateDeviceTable();
        this._updateButtonStates();
        // TODO: Update topology graph
        // TODO: Update manual edit ports
    }

    clearResults() {
         console.log("正在清空连接...");
         this.networkManager.clearConnections();
         this.clearResultsDisplay();
         this._updateDeviceTable();
         this._updateButtonStates();
        // ... (填充连接并添加到 networkManager) ...
        if (newConnections.length > 0) {
            this.updateTopologyGraph(); // 填充后更新图
        }
        // ... (更新连接列表和按钮) ...
    }

    displayConnections() {
          const outputArea = this.connectionsOutput; // 使用已获取的引用
          outputArea.innerHTML = '';
          const connections = this.networkManager.getAllConnections();

          if (connections.length > 0) {
              outputArea.innerHTML = '<b>连接列表:</b><hr style="margin-top: 4px; margin-bottom: 4px;">';
              connections.forEach((conn, i) => {
                 const [dev1, port1, dev2, port2, connType] = conn;
                  const line = document.createElement('div');
                  // 使用反引号模板字符串简化拼接
                  line.textContent = `${i + 1}. ${dev1.name} [${port1}] <-> ${dev2.name} [${port2}] (${connType})`;
                  outputArea.appendChild(line);
              });
          } else {
              outputArea.textContent = '无连接。';
          }
          // TODO: Update manual connection list display
          // TODO: Update topology graph
    }

    fillRemainingMesh() {
           console.log("开始填充剩余连接 (Mesh)...");
           const newConnections = this.networkManager.fill_connections_mesh(); // 仍然是空方法
           if (newConnections.length > 0) {
              this.displayConnections();
              this._updateDeviceTable();
              alert(`成功添加了 ${newConnections.length} 条新 Mesh 连接。`);
           } else {
               alert("没有找到更多可以建立的 Mesh 连接（或功能未实现）。");
           }
           this._updateButtonStates();
    }

    fillRemainingRing() {
            console.log("开始填充剩余连接 (Ring)...");
            const newConnections = this.networkManager.fill_connections_ring(); // 仍然是空方法
            if (newConnections.length > 0) {
               this.displayConnections();
               this._updateDeviceTable();
               this.updateTopologyGraph(); // 填充后更新图
                alert(`成功添加了 ${newConnections.length} 条新环形连接段。`);
            } else {
                alert("没有找到更多可以建立的环形连接段（或功能未实现）。");
            }
             this._updateButtonStates();
    }

    // --- 其他辅助方法 ---
    filterDeviceTable() {
         const filterText = this.deviceFilterInput.value.toLowerCase();
         const rows = this.deviceTableBody.querySelectorAll('tr');
         rows.forEach(row => {
             if (!row.dataset.deviceId) { row.style.display = ''; return; }
             const name = row.cells[0]?.textContent.toLowerCase() || '';
             const type = row.cells[1]?.textContent.toLowerCase() || '';
             const isVisible = name.includes(filterText) || type.includes(filterText);
             row.style.display = isVisible ? '' : 'none';
         });
    }

    clearResultsDisplay() {
          this.connectionsOutput.textContent = '无连接。';
          // TODO: Clear topology graph
          console.log("清除计算结果显示区域");
    }

    showDeviceDetails(deviceId) {
          const device = this.networkManager.getDeviceById(deviceId);
          if (device) {
               let details = `ID: ${device.id}\n名称: ${device.name}\n类型: ${device.type}\n`;
               if (UHD_TYPES.includes(device.type)) {
                   details += `${PORT_MPO} 总数: ${device.mpoTotal}\n${PORT_LC} 总数: ${device.lcTotal}\n`;
               } else if (device.type === DEV_MN) {
                   details += `${PORT_SFP}+ 总数: ${device.sfpTotal}\n`;
               }
               details += `当前连接数 (估): ${device.getConnectionsFormatted()}\n`;
               details += `\n可用端口:\n ${device.getAllAvailablePorts().join('\n ') || '无'}\n`; // 换行显示更清晰

               // 显示已连接端口
               const connections = device.portConnections;
               const connectedPorts = Object.keys(connections);
               if (connectedPorts.length > 0) {
                    details += "\n已连接端口:\n";
                    connectedPorts.sort().forEach(port => { // 简单排序
                        details += `  ${port} -> ${connections[port]}\n`;
                    });
               } else {
                   details += "\n无已连接端口。\n";
               }

              alert(details);
          } else {
              alert("找不到设备信息。");
          }
      }

} // class UIController 结束

// 文件末尾日志
console.log("uiController.js file loaded and UIController class defined.");