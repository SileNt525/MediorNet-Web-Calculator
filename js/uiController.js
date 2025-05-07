// js/uiController.js

class UIController {
    constructor(networkManager) {
        this.networkManager = networkManager; // 引用 NetworkManager 实例

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

        // 计算按钮 (暂时获取引用，在后续阶段启用)
        this.calculateBtn = document.getElementById('calculate-btn');
        this.fillMeshBtn = document.getElementById('fill-mesh-btn');
        this.fillRingBtn = document.getElementById('fill-ring-btn');
        this.clearConnectionsBtn = document.getElementById('clear-connections-btn');

        // 导出按钮 (暂时获取引用)
        // ...

        this.selectedDeviceIds = new Set(); // 存储选中的设备 ID
    }

    // 初始化 UI 组件和事件监听器
    initialize() {
        this.populateDeviceTypes();
        this.updatePortInputs(); // 初始化时根据默认类型更新端口输入
        this._updateDeviceTable(); // 初始化表格
        this._updatePortTotalsDisplay(); // 初始化总数
        this._updateButtonStates(); // 初始化按钮状态

        // --- 事件监听 ---
        this.deviceTypeSelect.addEventListener('change', () => this.updatePortInputs());
        this.addDeviceBtn.addEventListener('click', () => this.addDevice());
        this.clearDevicesBtn.addEventListener('click', () => this.clearAllDevices());
        this.removeDeviceBtn.addEventListener('click', () => this.removeSelectedDevices());
        this.deviceFilterInput.addEventListener('input', () => this.filterDeviceTable());

        // 使用事件委托处理表格行点击事件，以支持动态添加的行
        this.deviceTableBody.addEventListener('click', (event) => {
             // 寻找被点击的行
            const row = event.target.closest('tr');
            if (row && row.dataset.deviceId) {
                const deviceId = parseInt(row.dataset.deviceId, 10);
                // 切换选中状态
                if (this.selectedDeviceIds.has(deviceId)) {
                    this.selectedDeviceIds.delete(deviceId);
                    row.classList.remove('bg-blue-100'); // 移除高亮
                } else {
                    this.selectedDeviceIds.add(deviceId);
                    row.classList.add('bg-blue-100'); // 添加高亮
                }
                this._updateButtonStates(); // 更新移除按钮状态
            }
        });

        console.log("UI Controller Initialized");
    }

    // 填充设备类型下拉菜单
    populateDeviceTypes() {
        const deviceTypes = [DEV_UHD, DEV_HORIZON, DEV_MN];
        deviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            this.deviceTypeSelect.appendChild(option);
        });
    }

    // 根据选择的设备类型更新端口输入框
    updatePortInputs() {
        const selectedType = this.deviceTypeSelect.value;
        this.portInputsContainer.innerHTML = ''; // 清空现有输入

        const createInput = (id, label, defaultValue) => {
            const div = document.createElement('div');
            div.className = 'port-input-group'; // 添加class方便控制显隐
            div.innerHTML = `
                <label for="${id}" class="block text-sm font-medium text-gray-700">${label}:</label>
                <input type="number" id="${id}" value="${defaultValue}" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm p-1">
            `;
            this.portInputsContainer.appendChild(div);
        };

        if (UHD_TYPES.includes(selectedType)) {
            createInput('mpo-ports', `${PORT_MPO} 端口`, '2');
            createInput('lc-ports', `${PORT_LC} 端口`, '2');
        } else if (selectedType === DEV_MN) {
            createInput('sfp-ports', `${PORT_SFP}+ 端口`, '8');
        }
    }

    // 添加设备
    addDevice() {
        const type = this.deviceTypeSelect.value;
        const name = this.deviceNameInput.value.trim();

        if (!name) {
            alert("请输入设备名称。");
            return;
        }

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
        } catch (e) {
            validPorts = false;
        }


        if (!validPorts) {
             alert("端口数量必须是非负整数。");
             return;
        }

        const newDevice = this.networkManager.addDevice(name, type, mpoPorts, lcPorts, sfpPorts);

        if (newDevice) {
            this.deviceNameInput.value = ''; // 清空名称输入框
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates(); // 更新按钮状态
            // 未来: 需要更新手动编辑下拉框
        }
        // 名称重复的错误提示已在 NetworkManager 中处理
    }

    // 移除选中的设备
    removeSelectedDevices() {
        if (this.selectedDeviceIds.size === 0) {
            alert("请先选择要移除的设备。");
            return;
        }

        // TODO: 实现跳过确认的逻辑
        const confirmed = confirm(`确定要移除选中的 ${this.selectedDeviceIds.size} 个设备吗？\n（注意：与设备相关的连接目前不会被移除，此功能待实现）`);

        if (confirmed) {
            let removedCount = 0;
            this.selectedDeviceIds.forEach(id => {
                if (this.networkManager.removeDevice(id)) {
                    removedCount++;
                }
            });
            console.log(`移除了 ${removedCount} 个设备。`);
            this.selectedDeviceIds.clear(); // 清空选中集合
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates();
        }
    }

    // 清空所有设备
    clearAllDevices() {
         if (this.networkManager.getAllDevices().length === 0) return;

         // TODO: 实现跳过确认的逻辑
        const confirmed = confirm("确定要清空所有设备和连接吗？");
        if (confirmed) {
            this.networkManager.clearAllDevicesAndConnections();
            this.selectedDeviceIds.clear();
            this._updateDeviceTable();
            this._updatePortTotalsDisplay();
            this._updateButtonStates();
            // 清空计算结果显示和图形 (后续实现)
            this.clearResultsDisplay();
        }
    }

    // 更新设备表格显示
    _updateDeviceTable() {
        this.deviceTableBody.innerHTML = ''; // 清空表格
        const devices = this.networkManager.getAllDevices();

        if (devices.length === 0) {
            // 可以选择显示一个"无设备"的提示行
            const row = this.deviceTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7; // 合并所有列
            cell.textContent = '无设备';
            cell.className = 'text-center text-gray-500 py-4';
        } else {
             devices.forEach(dev => {
                const row = this.deviceTableBody.insertRow();
                row.dataset.deviceId = dev.id; // 存储设备 ID

                // 根据选中状态添加高亮
                if (this.selectedDeviceIds.has(dev.id)) {
                    row.classList.add('bg-blue-100');
                }

                // 填充单元格
                row.insertCell().textContent = dev.name;
                row.insertCell().textContent = dev.type;
                row.insertCell().textContent = dev.mpoTotal;
                row.insertCell().textContent = dev.lcTotal;
                row.insertCell().textContent = dev.sfpTotal;
                // 连接数需要从 device 对象获取
                row.insertCell().textContent = dev.getConnectionsFormatted();
                // 操作按钮单元格
                const actionCell = row.insertCell();
                 actionCell.className = 'text-center';
                // 可以添加图标或按钮，例如一个简单的移除按钮（但我们已有批量移除）
                // 或者一个详情按钮(后续添加)
                // const detailsBtn = document.createElement('button');
                // detailsBtn.textContent = '👁️';
                // detailsBtn.className = 'text-xs';
                // detailsBtn.onclick = () => this.showDeviceDetails(dev.id);
                // actionCell.appendChild(detailsBtn);

                 // 设置文本居中等样式
                 row.cells[2].className = 'text-center';
                 row.cells[3].className = 'text-center';
                 row.cells[4].className = 'text-center';
                 row.cells[5].className = 'text-center';
            });
        }
         this.filterDeviceTable(); // 应用当前过滤器
    }

    // 更新端口总数显示
    _updatePortTotalsDisplay() {
         const totals = this.networkManager.calculatePortTotals();
         this.portTotalsLabel.textContent = `总计: ${PORT_MPO}: ${totals.mpo}, ${PORT_LC}: ${totals.lc}, ${PORT_SFP}+: ${totals.sfp}`;
    }

    // 更新按钮的启用/禁用状态
    _updateButtonStates() {
        const hasDevices = this.networkManager.getAllDevices().length > 0;
        const hasSelection = this.selectedDeviceIds.size > 0;
        const hasConnections = this.networkManager.getAllConnections().length > 0; // 后续使用

        this.clearDevicesBtn.disabled = !hasDevices;
        this.removeDeviceBtn.disabled = !hasSelection;

        // 计算和填充按钮的状态 (后续更新)
        this.calculateBtn.disabled = !hasDevices;
        this.clearConnectionsBtn.disabled = !hasConnections;
        // 填充按钮逻辑更复杂，需要检查是否有可用端口
        const canFill = hasConnections || this.networkManager.getAllDevices().some(dev => dev.getAllAvailablePorts().length > 0);
        this.fillMeshBtn.disabled = !canFill;
        this.fillRingBtn.disabled = !canFill;

        // 导出按钮（后续更新）
        // ...
    }

     // 清空计算结果区域 (占位)
     clearResultsDisplay() {
        document.getElementById('connections-output').textContent = '无连接。';
        // TODO: 清空 Cytoscape 图形
        console.log("清除计算结果显示区域");
        this._updateButtonStates(); // 连接清空后更新按钮状态
     }

     // 过滤设备表格
     filterDeviceTable() {
        const filterText = this.deviceFilterInput.value.toLowerCase();
        const rows = this.deviceTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            if (!row.dataset.deviceId) { // 跳过 "无设备" 行
                row.style.display = '';
                return;
            }
            const name = row.cells[0]?.textContent.toLowerCase() || '';
            const type = row.cells[1]?.textContent.toLowerCase() || '';
            const isVisible = name.includes(filterText) || type.includes(filterText);
            row.style.display = isVisible ? '' : 'none';
        });
     }

     // 显示设备详情 (占位)
     showDeviceDetails(deviceId) {
        const device = this.networkManager.getDeviceById(deviceId);
        if (device) {
            // 简单的 alert 提示，后续可以做成更漂亮的模态框
             let details = `ID: ${device.id}\n名称: ${device.name}\n类型: ${device.type}\n`;
             if (UHD_TYPES.includes(device.type)) {
                 details += `MPO 总数: ${device.mpoTotal}\nLC 总数: ${device.lcTotal}\n`;
             } else if (device.type === DEV_MN) {
                 details += `SFP+ 总数: ${device.sfpTotal}\n`;
             }
             details += `当前连接数 (估): ${device.getConnectionsFormatted()}\n`;
             details += `\n可用端口:\n ${device.getAllAvailablePorts().join(', ') || '无'}`;
             // TODO: 添加已连接端口信息

            alert(details);
        } else {
            alert("找不到设备信息。");
        }
     }
}