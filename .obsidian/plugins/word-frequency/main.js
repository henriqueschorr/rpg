'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    blacklist: 'the,and,to,of,a,in,for,on,is,it,that,with,as,this,by,your,you',
    threshold: 3,
};
const ELEMENT_CLASSES = {
    containerButton: 'word-frequency-button-container',
    containerContent: 'word-frequency-sidebar-content',
    containerCount: 'word-frequency-count-container',
    containerFilter: 'word-frequency-filter-container',
    containerRow: 'word-frequency-row',
    containerThreshold: 'word-frequency-threshold-display',
    containerWordList: 'word-frequency-word-list',
    filter: 'word-frequency-filter',
    settingBlacklist: 'word-frequency-setting-blacklist',
    settingInfoItem: 'word-frequency-setting-item-info',
    settingItem: 'word-frequency-setting-item',
};
const COMMAND_ID_SHOW_SIDEBAR = 'word-frequency-show-sidebar';
const EVENT_UPDATE = 'word-frequency-update';
const FREQUENCY_ICON = 'file-chart-column-increasing';
const PLUGIN_NAME = 'Word frequency';
const SETTINGS_DESCRIPTIONS = {
    blacklist: 'Comma-separated list of words to exclude.',
    threshold: 'Only show words that appear at least this many times.',
};
const SETTINGS_NAMES = {
    blacklist: 'Blacklist',
    threshold: 'Word frequency threshold',
};
const VIEW_TYPE = 'word-frequency-view';

class ViewManager {
    plugin;
    constructor(plugin) {
        this.plugin = plugin;
    }
    getOrCreateLeaf(workspace, viewType) {
        const leaves = workspace.getLeavesOfType(viewType);
        if (leaves.length > 0) {
            return leaves[0];
        }
        return workspace.getRightLeaf(false);
    }
    async setViewState(leaf, viewType) {
        await leaf.setViewState({
            type: viewType,
            active: true,
        });
    }
    updateContent() {
        const editor = this.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
        this.plugin.frequencyCounter.triggerUpdateContent(editor);
    }
}

function segmentText(content) {
    const normalized = content.toLowerCase().normalize('NFKC');
    const stripped = normalized.replace(/[^\p{L}\p{N}\s]+/gu, '');
    return stripped
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0);
}

class WordFrequencyCounter {
    debouncedEditorChange;
    lastActiveEditor;
    plugin;
    constructor(plugin, 
    /* eslint-disable no-unused-vars */
    debouncedEditorChange = obsidian.debounce((editor) => this.triggerUpdateContent(editor), 3000)
    /* eslint-enable no-unused-vars */
    ) {
        this.debouncedEditorChange = debouncedEditorChange;
        this.plugin = plugin;
    }
    calculateWordFrequencies(content) {
        if (content.length === 0) {
            return [];
        }
        const words = segmentText(content);
        const wordCounts = new Map();
        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
        return Array.from(wordCounts.entries()).sort(([, countA], [, countB]) => countB - countA);
    }
    handleActiveLeafChange(leaf, workspace) {
        if (leaf === null) {
            return;
        }
        if (!(leaf.view instanceof obsidian.MarkdownView)) {
            return;
        }
        this.plugin.registerEvent(workspace.on('editor-change', (editor) => this.debouncedEditorChange(editor)));
        const activeView = workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (activeView) {
            this.lastActiveEditor = activeView.editor;
        }
        if (workspace.getLeavesOfType(VIEW_TYPE).length > 0) {
            this.triggerUpdateContent(this.lastActiveEditor);
        }
    }
    triggerUpdateContent(editor) {
        if (editor === undefined) {
            if (this.lastActiveEditor === undefined) {
                return;
            }
            editor = this.lastActiveEditor;
        }
        try {
            const wordCounts = this.calculateWordFrequencies(editor.getValue());
            window.document.dispatchEvent(new CustomEvent(EVENT_UPDATE, { detail: { wordCounts } }));
        }
        catch (error) {
            console.error('error in triggerUpdateContent', error);
        }
    }
}

class WordFrequencyDisplay {
    getFilter;
    debouncedFilterInput;
    filter = '';
    plugin;
    view;
    constructor(plugin, view, 
    /* eslint-disable no-unused-vars */
    getFilter = () => this.filter, debouncedFilterInput = obsidian.debounce((event) => {
        const target = event.target;
        this.filter = target.value;
        this.view.updateContent();
    }, 500)
    /* eslint-enable no-unused-vars */
    ) {
        this.getFilter = getFilter;
        this.debouncedFilterInput = debouncedFilterInput;
        this.plugin = plugin;
        this.view = view;
    }
    addWordToSidebar(blacklist, word, count, contentContainer) {
        if (blacklist.has(word) ||
            count < this.plugin.settings.threshold ||
            !word.toLowerCase().includes(this.getFilter().toLowerCase())) {
            return;
        }
        const row = contentContainer.createEl('div', {
            cls: ELEMENT_CLASSES.containerRow,
        });
        const wordCountContainer = row.createEl('div', {
            cls: ELEMENT_CLASSES.containerCount,
        });
        wordCountContainer.createEl('span', { text: word });
        wordCountContainer.createEl('span', { text: count.toString() });
        const buttonContainer = row.createEl('div', {
            cls: ELEMENT_CLASSES.containerButton,
        });
        const button = buttonContainer.createEl('button');
        obsidian.setIcon(button, 'trash-2');
        this.plugin.registerDomEvent(button, 'click', () => {
            this.saveWordToBlacklist(word);
        });
    }
    createFilter(contentEl) {
        const filterContainer = contentEl.createEl('div', {
            cls: ELEMENT_CLASSES.containerFilter,
        });
        const filterInput = filterContainer.createEl('input', {
            cls: ELEMENT_CLASSES.filter,
            attr: {
                type: 'text',
                placeholder: 'Type to filter results',
            },
        });
        this.plugin.registerDomEvent(filterInput, 'input', (event) => this.debouncedFilterInput(event));
    }
    createHeader(contentEl) {
        const headerContainer = contentEl.createEl('div');
        const headerElement = headerContainer.createEl('h4');
        headerElement.setText(PLUGIN_NAME);
    }
    createThresholdDisplay(contentEl) {
        const thresholdDisplay = contentEl.createEl('div', {
            cls: ELEMENT_CLASSES.containerThreshold,
        });
        thresholdDisplay.setText(`Current frequency threshold is ${this.plugin.settings.threshold}.`);
        thresholdDisplay.setAttr('title', 'Configure settings for this plugin to update the frequency threshold.');
    }
    saveWordToBlacklist(word) {
        const settings = this.plugin.settings;
        settings.blacklist += `,${word}`;
        this.plugin.saveData(settings);
        this.view.updateContent();
    }
}

class WordFrequencyView extends obsidian.ItemView {
    display;
    eventListener = () => { };
    plugin;
    wordCountList = [];
    wordListContainer;
    constructor(leaf, plugin, display, divElement) {
        super(leaf);
        this.plugin = plugin;
        this.display = display ?? new WordFrequencyDisplay(plugin, this);
        // TODO: find a better way to set a default value
        this.wordListContainer = divElement ?? this.containerEl.createDiv();
    }
    getDisplayText() {
        return PLUGIN_NAME;
    }
    getIcon() {
        return FREQUENCY_ICON;
    }
    getPlugin() {
        return this.plugin;
    }
    getViewType() {
        return VIEW_TYPE;
    }
    async onOpen() {
        this.eventListener = (event) => {
            if (event.type === EVENT_UPDATE) {
                this.wordCountList = event.detail.wordCounts;
                this.updateContent();
            }
        };
        window.document.addEventListener(EVENT_UPDATE, this.eventListener);
        this.contentEl.empty();
        const contentContainer = this.contentEl.createDiv({
            cls: ELEMENT_CLASSES.containerContent,
        });
        this.display.createHeader(contentContainer);
        this.display.createFilter(contentContainer);
        this.wordListContainer = contentContainer.createDiv({
            cls: ELEMENT_CLASSES.containerWordList,
        });
        this.display.createThresholdDisplay(contentContainer);
        this.updateContent();
    }
    async onClose() {
        window.document.removeEventListener(EVENT_UPDATE, this.eventListener);
    }
    updateContent() {
        this.wordListContainer.empty();
        const blacklist = new Set(this.plugin.settings.blacklist.split(',').map((word) => word.trim()));
        this.wordCountList.forEach(([word, count]) => {
            this.display.addWordToSidebar(blacklist, word, count, this.wordListContainer);
        });
    }
}

class WordFrequencySettingTab extends obsidian.PluginSettingTab {
    plugin;
    settingFactory;
    constructor(plugin, settingFactory = (element) => new obsidian.Setting(element)) {
        super(plugin.app, plugin);
        this.plugin = plugin;
        this.settingFactory = settingFactory;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        const blacklist = this.settingFactory(containerEl)
            .setName(SETTINGS_NAMES.blacklist)
            .setDesc(SETTINGS_DESCRIPTIONS.blacklist)
            .setClass(ELEMENT_CLASSES.settingItem)
            .addTextArea((text) => {
            text.setValue(this.plugin.settings.blacklist)
                .onChange(async (value) => {
                await this.saveBlacklistValue(value);
            })
                .inputEl.classList.add(ELEMENT_CLASSES.settingBlacklist);
        });
        blacklist.infoEl.addClass(ELEMENT_CLASSES.settingInfoItem);
        this.settingFactory(containerEl)
            .setName(SETTINGS_NAMES.threshold)
            .setDesc(SETTINGS_DESCRIPTIONS.threshold)
            .addText((text) => text
            .setPlaceholder('3')
            .setValue(this.plugin.settings.threshold.toString())
            .onChange(async (value) => {
            await this.updateThreshold(value);
        }));
    }
    async saveBlacklistValue(value) {
        this.plugin.settings.blacklist = value;
        await this.plugin.saveSettings();
    }
    async updateThreshold(value) {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
            return;
        }
        this.plugin.settings.threshold = num;
        await this.plugin.saveSettings();
        this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
            if (leaf.view instanceof WordFrequencyView) {
                leaf.view.updateContent();
            }
        });
    }
}

class WordFrequencyPlugin extends obsidian.Plugin {
    createView;
    frequencyCounter;
    settings = DEFAULT_SETTINGS;
    settingTab;
    viewManager;
    constructor(app, manifest, viewManager, settingTab, frequencyCounter, 
    /* eslint-disable no-unused-vars */
    createView = (leaf) => new WordFrequencyView(leaf, this)
    /* eslint-enable no-unused-vars */
    ) {
        super(app, manifest);
        this.createView = createView;
        this.settingTab = settingTab ?? new WordFrequencySettingTab(this);
        this.viewManager = viewManager ?? new ViewManager(this);
        this.frequencyCounter =
            frequencyCounter ?? new WordFrequencyCounter(this);
    }
    async onload() {
        const title = `Show ${PLUGIN_NAME.toLowerCase()} sidebar`;
        await this.loadSettings();
        this.registerView(VIEW_TYPE, this.createView);
        this.addRibbonIcon(FREQUENCY_ICON, title, () => this.activateView());
        this.addCommand({
            id: COMMAND_ID_SHOW_SIDEBAR,
            name: title,
            callback: () => this.activateView(),
        });
        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
            this.frequencyCounter.handleActiveLeafChange(leaf, this.app.workspace);
        }));
        this.addSettingTab(this.settingTab);
    }
    onunload() { }
    async activateView() {
        const { workspace } = this.app;
        const leaf = this.viewManager.getOrCreateLeaf(workspace, VIEW_TYPE);
        if (leaf === null) {
            return;
        }
        await this.viewManager.setViewState(leaf, VIEW_TYPE);
        await workspace.revealLeaf(leaf);
        this.viewManager.updateContent();
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    async loadSettings() {
        const settings = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    }
}

module.exports = WordFrequencyPlugin;

/* nosourcemap */