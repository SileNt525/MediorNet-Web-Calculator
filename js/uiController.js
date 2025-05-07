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


        console.log("UI Controller Initialized method finished.");
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
         // TODO: Clear manual edit list
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