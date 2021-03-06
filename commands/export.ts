import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import { AtelierAPI } from '../api';
import { outputChannel, mkdirSyncRecursive } from '../utils';
import { PackageNode } from '../explorer/models/packageNode';
import { ClassNode } from '../explorer/models/classesNode';
import { RoutineNode } from '../explorer/models/routineNode';
import { config } from '../extension';

const filesFilter = (file: any) => {
  if (file.cat === 'CSP' || file.name.startsWith('%') || file.name.startsWith('INFORMATION.')) {
    return false;
  }
  return true;
};

const getFileName = (folder: string, name: string, split: boolean): string => {
  let fileNameArray: string[] = name.split('.');
  let fileExt = fileNameArray.pop().toLowerCase();
  const root = vscode.workspace.rootPath;
  const cat = fileExt === 'cls' ? 'CLS' : ['int', 'mac', 'inc'].includes(fileExt) ? 'RTN' : 'OTH';
  if (split) {
    let fileName = [root, folder, cat, ...fileNameArray].join(path.sep);
    return [fileName, fileExt].join('.');
  }
  return [root, folder, cat, name].join(path.sep);
};

export async function exportFile(name: string, fileName: string): Promise<any> {
  if (!config('conn').active) {
    return;
  }
  const api = new AtelierAPI();
  const log = status => outputChannel.appendLine(`export "${name}" as "${fileName}" - ${status}`);
  const folders = path.dirname(fileName);
  return mkdirSyncRecursive(folders)
    .then(() => {
      return api.getDoc(name).then(data => {
        if (!data || !data.result) {
          throw new Error('Something wrong happened');
        }
        const content = data.result.content;
        fs.writeFileSync(fileName, (content || []).join('\n'));
        log('Success');
      });
    })
    .catch(error => {
      log('ERROR: ' + error);
    });
}

export async function exportList(files: string[]): Promise<any> {
  if (!files || !files.length) {
    vscode.window.showWarningMessage('Nothing to export');
  }
  const { atelier, folder } = config().get('export');

  return Promise.all(
    files.map(file => {
      exportFile(file, getFileName(folder, file, atelier));
    })
  );
}

export async function exportAll(): Promise<any> {
  if (!config('conn').active) {
    return;
  }
  const api = new AtelierAPI();
  outputChannel.show(true);
  const { category, generated, filter } = config().get('export');
  const files = data => data.result.content.filter(filesFilter).map(file => file.name);
  return api.getDocNames({ category, generated, filter }).then(data => {
    return exportList(files(data));
  });
}

export async function exportExplorerItem(node: PackageNode | ClassNode | RoutineNode): Promise<any> {
  if (!config('conn').active) {
    return;
  }
  const items = node instanceof PackageNode ? node.getClasses() : [node.fullName];
  return exportList(items);
}
