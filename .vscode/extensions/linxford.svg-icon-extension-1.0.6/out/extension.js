"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fse = __importStar(require("fs-extra"));
const yaml = __importStar(require("js-yaml"));
// Enum for different icon types
var IconType;
(function (IconType) {
    IconType["bold"] = "bold";
    IconType["broken"] = "broken";
    IconType["bulk"] = "bulk";
    IconType["linear"] = "linear";
    IconType["outline"] = "outline";
    IconType["twotone"] = "twotone";
})(IconType || (IconType = {}));
// Main function to activate the extension
function activate(context) {
    console.log('SVG Icon Extension activated.');
    // Register the search icon command
    let searchCommand = vscode.commands.registerCommand('svg-icons-extension.searchIcons', async () => {
        console.log('Search Icons command executed.');
        // Ensure icon directories are created
        const iconBasePath = ensureIconDirectories(context.extensionPath);
        // Prompt the user for icon type
        const iconType = await vscode.window.showQuickPick(Object.keys(IconType), { placeHolder: 'Choose an icon type (outline, linear, bold, broken, twotone)' });
        if (!iconType) {
            return; // User cancelled the operation
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const completionItems = await getIconCompletionItems(iconType.toLowerCase(), context.extensionPath);
            const iconName = await vscode.window.showQuickPick(completionItems.map(item => ({
                label: item.label.toString(),
                description: item.documentation instanceof vscode.MarkdownString ? item.documentation.value : ''
            })), { placeHolder: 'Start typing the icon name...' });
            if (!iconName) {
                return; // User cancelled the operation
            }
            const iconPath = path.join('assets', 'icons', iconType.toLowerCase(), `${iconName.label}.svg`);
            const fullIconPath = path.join(iconBasePath, iconType.toLowerCase(), `${iconName.label}.svg`);
            // Check if the icon exists; if not, copy it from the bundled icons
            if (!fs.existsSync(fullIconPath)) {
                copyIconFromBundle(iconType.toLowerCase(), iconName.label, fullIconPath, context.extensionPath);
            }
            editor.edit(editBuilder => {
                editor.selections.forEach(selection => {
                    editBuilder.replace(selection, iconPath); // Insert the relative path
                });
            });
            vscode.window.showInformationMessage(`Icon path '${iconPath}' inserted successfully!`);
            // Update pubspec.yaml with new icon directories
            updatePubspecWithIconDirectories();
        }
    });
    context.subscriptions.push(searchCommand);
    // Register icon completion provider for supported languages
    const iconCompletionProvider = vscode.languages.registerCompletionItemProvider(['html', 'dart', 'typescript', 'javascript'], {
        provideCompletionItems: async (document, position) => {
            const lineText = document.lineAt(position).text;
            const iconTypeMatch = Object.keys(IconType).find(type => lineText.includes(type));
            if (!iconTypeMatch) {
                return [];
            }
            const iconType = iconTypeMatch.toLowerCase();
            const completionItems = await getIconCompletionItems(iconType, context.extensionPath);
            return completionItems;
        }
    }, ':' // Trigger autocomplete when the user types `:` after typing the icon type
    );
    context.subscriptions.push(iconCompletionProvider);
}
// Get the icon completion items with preview
async function getIconCompletionItems(iconType, extensionPath) {
    const iconDir = path.join(extensionPath, 'assets', 'icons', iconType);
    const iconFiles = fs.readdirSync(iconDir);
    const completionItems = iconFiles.map(iconFile => {
        const iconName = path.basename(iconFile, '.svg');
        const iconPath = vscode.Uri.file(path.join(iconDir, iconFile));
        const completionItem = new vscode.CompletionItem(iconName, vscode.CompletionItemKind.File);
        // Add icon preview in detail
        completionItem.detail = iconName;
        completionItem.documentation = new vscode.MarkdownString(`![${iconName}](${iconPath.toString()})`);
        return completionItem;
    });
    return completionItems;
}
// Ensure the required icon directories exist, create them if necessary, and copy bundled icons
function ensureIconDirectories(extensionPath) {
    // Get the root path of the current Flutter project
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return '';
    }
    const iconDirPath = path.join(workspaceFolder, 'assets', 'icons');
    // Create directories for each icon type if they don't exist
    Object.values(IconType).forEach(type => {
        const dirPath = path.join(iconDirPath, type.toLowerCase());
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            // Copy the bundled icons from the extension to the Flutter project
            const bundledIconPath = path.join(extensionPath, 'assets', 'icons', type.toLowerCase());
            if (fs.existsSync(bundledIconPath)) {
                fse.copySync(bundledIconPath, dirPath); // Copy icons recursively
            }
        }
    });
    return iconDirPath;
}
// Update pubspec.yaml with new icon directories
function updatePubspecWithIconDirectories() {
    // Get the root path of the current Flutter project
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return;
    }
    const pubspecPath = path.join(workspaceFolder, 'pubspec.yaml');
    console.log(`Looking for pubspec.yaml at: ${pubspecPath}`);
    if (fs.existsSync(pubspecPath)) {
        const fileContent = fs.readFileSync(pubspecPath, 'utf8');
        const data = yaml.load(fileContent);
        // Check if assets section already exists
        if (!data.flutter) {
            data.flutter = {};
        }
        if (!data.flutter.assets) {
            data.flutter.assets = [];
        }
        // Define icon directories to add
        const iconDirectories = Object.values(IconType).map(type => `assets/icons/${type.toLowerCase()}/`);
        // Add icon directories if they don't already exist
        let updated = false;
        iconDirectories.forEach(dir => {
            if (!data.flutter.assets.includes(dir)) {
                data.flutter.assets.push(dir);
                updated = true;
            }
        });
        // Write back to pubspec.yaml only if changes were made
        if (updated) {
            const yamlStr = yaml.dump(data);
            fs.writeFileSync(pubspecPath, yamlStr, 'utf8');
            vscode.window.showInformationMessage('pubspec.yaml updated with new icon directories!');
        }
        else {
            console.log('No changes needed in pubspec.yaml');
        }
    }
    else {
        vscode.window.showErrorMessage('pubspec.yaml not found!');
    }
}
// Copy an icon from the bundled assets to the required directory
function copyIconFromBundle(iconType, iconName, targetPath, basePath) {
    const sourcePath = path.join(basePath, 'assets', 'bundle', iconType, `${iconName}.svg`);
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Icon '${iconName}.svg' copied from bundle to ${targetPath}`);
    }
    else {
        console.warn(`Icon '${iconName}.svg' not found in the bundle.`);
        vscode.window.showWarningMessage(`Icon '${iconName}.svg' not found in the bundle.`);
    }
}
// Deactivate function
function deactivate() {
    console.log('SVG Icon Extension deactivated.');
}
//# sourceMappingURL=extension.js.map