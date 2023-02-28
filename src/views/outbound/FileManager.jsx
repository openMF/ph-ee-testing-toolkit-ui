/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation

 * ModusBox
 * Vijaya Kumar Guthi <vijaya.guthi@modusbox.com> (Original Author)
 --------------
 ******/
import React from 'react';
import { Button, Popconfirm, Row, Col, message, Popover } from 'antd';
import FolderBrowser from './FolderBrowser.jsx';
import { FolderParser } from '@mojaloop/ml-testing-toolkit-shared-lib';
import { DownOutlined } from '@ant-design/icons';
import GitHubBrowser from './GitHubBrowser';

import JSZip, { file } from 'jszip';
const MASTERFILE_NAME = 'master.json';

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result);
        };

        reader.onerror = reject;

        reader.readAsText(file);
    });
}

function buildFileSelector(multi = false, directory = false) {
    const fileSelector = document.createElement('input');
    fileSelector.setAttribute('type', 'file');
    if(multi) {
        fileSelector.setAttribute('multiple', 'multiple');
    }
    if(directory) {
        fileSelector.setAttribute('webkitdirectory', '');
    }
    return fileSelector;
}

class FileManager extends React.Component {
    state = {
        importFromGitHubDialogVisible: false,
    };

    componentDidMount = () => {
        if(this.props.ipcRenderer) {
            this.props.ipcRenderer.on('rendererAction', (event, actionData) => {
                if(actionData.action === 'importFolderData') {
                    if(actionData.nativeFilePath) {
                        localStorage.setItem('nativeFilePath', actionData.nativeFilePath);
                    }
                    this.updateFoldersAndFiles(actionData.data);
                } else if(actionData.action === 'savingStatusStart') {
                    message.loading({ content: 'Saving files...', key: 'saveFolderDataProgress' });
                } else if(actionData.action === 'savingStatusError') {
                    message.error({ content: actionData.message, key: 'saveFolderDataProgress' });
                } else if(actionData.action === 'savingStatusSuccess') {
                    message.success({ content: 'Saved', key: 'saveFolderDataProgress' });
                }
            });
        }

        this.collectionFolderSelector = buildFileSelector(false, true);
        this.collectionFolderSelector.addEventListener('input', async e => {
            if(e.target.files && e.target.files.length > 0) {
                await this.handleLocalFileOrFolderImportCollection(e.target.files);
            }
            // wait for all async functions to complete before clearing the selector state
            this.collectionFolderSelector.value = null;
        });

        this.collectionFileSelector = buildFileSelector(true, false);
        this.collectionFileSelector.addEventListener('input', async e => {
            if(e.target.files && e.target.files.length > 0) {
                await this.handleLocalFileOrFolderImportCollection(e.target.files);
            }
            // wait for all async functions to complete before clearing the selector state
            this.collectionFileSelector.value = null;
        });
    };

    getNodeFromLocation = (parentNode, locationArray) => {
        const foundNode = parentNode.find(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            return foundNode;
        } else {
            return this.getNodeFromLocation(foundNode.children, locationArray.slice(1));
        }
    };

    getNodeAtPosition = (parentNode, posArray) => {
        const foundNode = parentNode[posArray[0]];
        if(posArray.length === 1) {
            return foundNode;
        } else {
            return this.getNodeAtPosition(foundNode.children, posArray.slice(1));
        }
    };

    getDuplicateName = (parentNode, index) => {
        // const sourceTitle = parentNode[index].title;
        const newBaseTitle = parentNode[index].title + '_copy';
        let newTitle = newBaseTitle;
        for(let i = 0; i < parentNode.length; i++) {
            newTitle = newBaseTitle + i;
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            if(!parentNode.find(item => item.title === newTitle)) {
                break;
            }
        }
        return newTitle;
    };

    updateKeysRecursively = (node, newName, prefix) => {
        const reminderKey = node.key.replace(prefix + '/', '');
        const keyArr = reminderKey.split('/');
        keyArr[0] = newName;
        node.key = prefix + '/' + keyArr.join('/');
        if(!node.isLeaf) {
            for(let i = 0; i < node.children.length; i++) {
                this.updateKeysRecursively(node.children[i], newName, prefix);
            }
        }
    };

    resetKeysRecursively = (node, prefix) => {
        node.key = prefix + '/' + node.title;
        if(!node.isLeaf) {
            for(let i = 0; i < node.children.length; i++) {
                this.resetKeysRecursively(node.children[i], node.key);
            }
        }
    };

    deleteNodeAtLocation = (parentNode, locationArray) => {
        const foundNodeIndex = parentNode.findIndex(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            // Delete the file or folder
            parentNode.splice(foundNodeIndex, 1);
        } else {
            // console.log(locationArray, parentNode)
            this.deleteNodeAtLocation(parentNode[foundNodeIndex].children, locationArray.slice(1));
        }
    };

    deleteNodeAtPosition = (parentNode, posArray) => {
        if(posArray.length === 1) {
            // Delete the file or folder
            parentNode.splice(posArray[0], 1);
        } else {
            this.deleteNodeAtPosition(parentNode[posArray[0]].children, posArray.slice(1));
        }
    };

    addNodeAtPosition = (parentNode, posArray, nodeItem) => {
        if(posArray.length === 1) {
            // Delete the file or folder
            parentNode.splice(posArray[0], 0, nodeItem);
        } else {
            this.addNodeAtPosition(parentNode[posArray[0]].children, posArray.slice(1), nodeItem);
        }
    };

    addNodeAtLocation = (parentNode, locationArray, nodeItem) => {
        const foundNodeIndex = parentNode.findIndex(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            parentNode[foundNodeIndex].children.push(nodeItem);
        } else {
            this.addNodeAtLocation(parentNode[foundNodeIndex].children, locationArray.slice(1), nodeItem);
        }
    };

    addFileReferenceAtLocation = (parentNode, locationArray, fileLocation, refKey, refTitle) => {
        const foundNodeIndex = parentNode.findIndex(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            parentNode[foundNodeIndex].children.push({
                key: refKey,
                title: refTitle,
                isLeaf: true,
                extraInfo: {
                    type: 'fileRef',
                    path: '/' + fileLocation,
                },
            });
        } else {
            this.addFileReferenceAtLocation(parentNode[foundNodeIndex].children, locationArray.slice(1), fileLocation, refKey, refTitle);
        }
    };

    duplicateNodeAtLocation = (parentNode, locationArray, prefix) => {
        const foundNodeIndex = parentNode.findIndex(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            // Duplicate the file or folder
            // Deep copy the source node
            const newNode = JSON.parse(JSON.stringify(parentNode[foundNodeIndex]));
            // Rename the title and key
            const newName = this.getDuplicateName(parentNode, foundNodeIndex);
            newNode.title = newName;
            // Rename the nexted keys
            this.updateKeysRecursively(newNode, newName, prefix);
            // Add the node next to the source node
            parentNode.splice(foundNodeIndex + 1, 0, newNode);
        } else {
            this.duplicateNodeAtLocation(parentNode[foundNodeIndex].children, locationArray.slice(1), prefix);
        }
    };

    renameNodeAtLocation = (parentNode, locationArray, prefix, newName) => {
        const foundNodeIndex = parentNode.findIndex(item => item.title === locationArray[0]);
        if(locationArray.length === 1) {
            // Rename the file or folder
            // Rename the title
            parentNode[foundNodeIndex].title = newName;
            // Rename the nexted keys
            this.updateKeysRecursively(parentNode[foundNodeIndex], newName, prefix);
        } else {
            this.renameNodeAtLocation(parentNode[foundNodeIndex].children, locationArray.slice(1), prefix, newName);
        }
    };

    updateFoldersAndFiles = importFolderRawData => {
        importFolderRawData.sort((a, b) => a.path.localeCompare(b.path));
        const folderData = FolderParser.getFolderData(importFolderRawData);
        this.props.onChange(folderData, []);
        this.forceUpdate();
    };

    handleNestedFolder = (testcase, path) => {

        let lengt = testcase.item.length;

        var arr = [];
        var patharr = [];
        patharr = path;
        try {
            patharr.push(testcase.name);
        } catch (err){
            console.log(err);
        }

        for(let z = 0; z < lengt; z++){
            if(!testcase.item[z].item){
                let res = this.handlepostmantestcases(testcase.item[z], patharr);
                res.id = z + 1;
                arr.push(res);
            } else {
                let folderitems = this.handleNestedFolder(testcase.item[z], patharr);
                arr = arr.concat(folderitems);
            }
        }
        return arr;
    }

    handlepostmantestcases = (testcase, path) => {
        let request = {
            'id': 1,
            'path': path,
            'meta': {
                'info': testcase.name,
            },
            'description': testcase.name,
            'apiVersion': {
                'minorVersion': 1,
                'majorVersion': 1,
                'type': 'postman',
                'asynchronous': false,
            },
            'operationPath': testcase.request.url.raw,
            'method': testcase.request.method,
            'headers': {},
            'params': {},
            'body': {},
            'tests': {
                'assertions': [],
            },
            'scriptingEngine': 'postman',
            'scripts': {
                'preRequest': {
                    'exec': [],
                },
                'postRequest': {
                    'exec': [],
                },
            },

        };
        let str = request.operationPath;
        let mstr = '';
        for(let k = 0; k < str.length; k = k + 1){
            if(str[k] == '{' || str[k] == '}'){
                mstr += str[k];
                k = k + 1;
            } else {
                mstr += str[k];
            }
        }
        request.operationPath = mstr;

        if(testcase.request.body){
            let json = testcase.request.body.raw;
            if(json == ''){
                request.body = {};
            } else {
                let contact  = JSON.parse(JSON.stringify(json));
                let obj = JSON.parse(contact.replace(/\r?\n|\r/g, ''));
            
                request.body = obj;
            }
            
        }
        
        
        testcase.request.header.forEach(function (item, index) {
            request.headers[item.key] = item.value;
        });

        if(testcase.request.url.query){
            testcase.request.url.query.forEach(function (item, index) {
                request.params[item.key] = item.value;
            });
        }
        if(testcase.event){
            testcase.event.forEach(function (item, index) {
                if(item.listen == 'test'){
                    request.scripts.postRequest.exec = item.script.exec;
                }
    
                if(item.listen == 'prerequest'){
                    request.scripts.preRequest.exec = item.script.exec;
                }
            });
        }
        
        
        return request;
    }

    handlePostmanCollectionFormat = (fileContent, fileName) => {
        const content = {
            'options': {},  
            'name': 'multi',
            'test_cases': [],
        };
        const arrlen = fileContent.item.length;

        let ungroupedapis = {
            'id': 1,
            'name': 'ungrouped',
            'fileInfo': {
                'path': fileName,
            },
            'meta': {
                'info': 'ungrouped',
            },
            'requests': [],
        };
        var k = 0;
        var count = 0;

        for(var i = 0; i < arrlen; i++){

            if(!fileContent.item[i].item){
                let res = this.handlepostmantestcases(fileContent.item[i], []);
                res.id = k + 1;
                ungroupedapis.requests.push(res);
            } else {
                count = count + 1;
                let contentitem = {
                    'id': count,
                    'name': fileContent.item[i].name,
                    'fileInfo': {
                        'path': fileName,
                    },
                    'meta': {
                        'info': fileContent.item[i].name,
                    },
                    'requests': [],
                };
                contentitem.id = i + 1;
                contentitem.name = fileContent.item[i].name;
                
                try {
                    let testcases = fileContent.item[i].item;
                    let testcaselen = testcases.length;
                    var patharr = [];
                    patharr.push(fileContent.item[i].name);
                    console.log(testcaselen);


                    for(var j = 0; j < testcaselen; j++){
                        try {
                            if(!testcases[j].item){
                                let res = this.handlepostmantestcases(testcases[j], patharr);
                                res.id = j + 1;
                                contentitem.requests.push(res);
                                console.log(j);
                            } else {
                                let folderitems = this.handleNestedFolder(testcases[j], patharr);
                                contentitem.requests = contentitem.requests.concat(folderitems);
                            }
                        } catch (err) {
                            console.log(err);
                        }
                        
                    }
                    contentitem.requests.push(res);
                } catch (err) {
                    console.log(err);
                }
                
                content.test_cases.push(contentitem);
            }
            
        }
        count = count + 1;
        ungroupedapis.id = count;
        if(ungroupedapis.requests.length){
            content.test_cases.push(ungroupedapis);
        }
        console.log(content);
        return content;

    }

    handleLocalFileOrFolderImportCollection = async fileList => {
        message.loading({ content: 'Reading the selected files...', key: 'importFileProgress' });
        const importFolderRawData = [];
        for(let i = 0; i < fileList.length; i++) {
            const fileToRead = fileList.item(i);
            if(fileToRead.name.endsWith('.json')) {
                // const fileRead = new FileReader();
                try {
                    const content = await readFileAsync(fileToRead);
                    let fileContent = JSON.parse(content);
                    console.log(fileContent);
                    if(fileContent.item){
                        console.log('validates');
                        const fileContents = this.handlePostmanCollectionFormat(fileContent, fileToRead.name);
                        console.log(fileContents);
                        fileContent = fileContents;
                    }
                    importFolderRawData.push({
                        name: fileToRead.name,
                        path: fileToRead.webkitRelativePath ? fileToRead.webkitRelativePath : fileToRead.name,
                        size: fileToRead.size,
                        modified: fileToRead.lastModified,
                        content: fileContent,
                    });
                    console.log(importFolderRawData);
                } catch (err) {
                    message.error({ content: err.message, key: 'importFileProgress', duration: 2 });
                    break;
                }
            }
        }
        this.updateFoldersAndFiles(importFolderRawData);
        message.success({ content: 'Files imported', key: 'importFileProgress', duration: 2 });
    };

    handleSelectionChanged = async selectedFiles => {
        this.props.onChange(this.props.folderData, selectedFiles);
    };

    handleOrderChange = async () => {
        this.props.onChange(this.props.folderData);
    };

    handleAddFileOrFolder = async (fileLocation, fileOrFolderName, isFolder = false) => {
        const nodeFound = this.getNodeFromLocation(this.props.folderData, fileLocation.split('/'));
        // Add the fileOrFoldername to the node
        const newItem = {
            key: fileLocation + '/' + fileOrFolderName,
            title: fileOrFolderName,
            isLeaf: !isFolder,
            extraInfo: { type: isFolder ? 'folder' : 'file' },
            content: isFolder ? null : {},
            children: isFolder ? [] : null,
        };
        nodeFound.children.push(newItem);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
        // this.forceUpdate()
    };

    handleDeleteFileOrFolder = async fileLocation => {
        this.deleteNodeAtLocation(this.props.folderData, fileLocation.split('/'));
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
        // this.forceUpdate()
    };

    handleDuplicateFileOrFolder = async (fileLocation, levelPrefix) => {
        this.duplicateNodeAtLocation(this.props.folderData, fileLocation.split('/'), levelPrefix);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
        // this.forceUpdate()
    };

    handleRenameFileOrFolder = async (fileLocation, newName, levelPrefix) => {
        this.renameNodeAtLocation(this.props.folderData, fileLocation.split('/'), levelPrefix, newName);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
        // this.forceUpdate()
    };

    handleMoveFileOrFolder = async (dragPos, dropPos, levelPrefix) => {
        // Find the node item from the drag position
        const nodeItem = this.getNodeAtPosition(this.props.folderData, dragPos);
        // Deep copy the node data into a variable
        const nodeItemCopy = JSON.parse(JSON.stringify(nodeItem));
        // Reset the keys for the moved node
        this.resetKeysRecursively(nodeItemCopy, levelPrefix);
        // Delete the node
        this.deleteNodeAtPosition(this.props.folderData, dragPos);
        // Modify drop position if deleted node is before the drag node
        if(dragPos[dragPos.length - 1] < dropPos[dragPos.length - 1]) {
            dropPos[dragPos.length - 1] -= 1;
        }
        // Add the node at the drop position
        this.addNodeAtPosition(this.props.folderData, dropPos, nodeItemCopy);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
    };

    handlePaste = async (fileLocation, levelPrefix) => {
        // Find the node item from the drag position
        const nodeItem = this.getNodeFromLocation(this.props.folderData, fileLocation.split('/'));
        // Deep copy the node data into a variable
        const nodeItemCopy = JSON.parse(JSON.stringify(nodeItem));
        // Reset the keys for the moved node
        this.resetKeysRecursively(nodeItemCopy, levelPrefix);
        // Copy the node at the paste location
        this.addNodeAtLocation(this.props.folderData, levelPrefix.split('/'), nodeItemCopy);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
    };

    handlePasteRef = async (fileLocation, refTitle, levelPrefix) => {
        // Copy the node reference at the paste location
        this.addFileReferenceAtLocation(this.props.folderData, levelPrefix.split('/'), fileLocation, levelPrefix + '/' + refTitle, refTitle);
        const newFolderData = [...this.props.folderData];
        this.props.onChange(newFolderData, []);
    };

    download = (content, fileName, contentType) => {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    };

    handleExportFolder = async () => {
        const generateMasterFile = nodesArray => {
            const nodesOrder = nodesArray.map(item => {
                return {
                    name: item.title,
                    ...item.extraInfo,
                };
            });
            return {
                order: nodesOrder,
            };
        };

        const removeStatusInfo = templateContent => {
            if(templateContent.test_cases) {
                for(let i = 0; i < templateContent.test_cases.length; i++) {
                    if(templateContent.test_cases[i].requests) {
                        for(let j = 0; j < templateContent.test_cases[i].requests.length; j++) {
                            if(templateContent.test_cases[i].requests[j].status) {
                                delete templateContent.test_cases[i].requests[j].status;
                            }
                        }
                    }
                }
            }
        };

        const addFilesToZipHandler = (nodeChildren, zipHandler) => {
            // Add master file
            if(nodeChildren.length > 1) {
                const masterFileContent = generateMasterFile(nodeChildren);
                zipHandler.file(MASTERFILE_NAME, JSON.stringify(masterFileContent, null, 2));
            }

            for(let i = 0; i < nodeChildren.length; i++) {
                if(nodeChildren[i].isLeaf && nodeChildren[i].extraInfo.type === 'file') {
                    const templateContent = nodeChildren[i].content;
                    removeStatusInfo(templateContent);
                    zipHandler.file(nodeChildren[i].title, JSON.stringify(templateContent, null, 2));
                } else {
                    if(nodeChildren[i].children) {
                        const folderHandler = zipHandler.folder(nodeChildren[i].title);
                        addFilesToZipHandler(nodeChildren[i].children, folderHandler);
                    }
                }
            }
        };

        try {
            const zip = new JSZip();
            addFilesToZipHandler(this.props.folderData, zip);
            const content = await zip.generateAsync({ type: 'blob' });
            // Form a name for the file to download
            const downloadFileName = this.props.folderData.map(item => item.title).join('-') + '-' + (new Date().toISOString()) + '.zip';
            this.download(content, downloadFileName, 'application/zip');
        } catch (err) {
            message.error({ content: err.message, key: 'importFileProgress', duration: 2 });
        }
    };

    handleStartNewFolder = () => {
        const newFolderData = [
            {
                key: 'new-folder',
                title: 'new-folder',
                children: [],
                extraInfo: { type: 'folder' },
            },
        ];
        this.props.onChange(newFolderData, []);
    };

    handleGitHubDownload = importedFolderData => {
        // TODO: Continue to fix this
        const newFolderData = [...this.props.folderData, ...importedFolderData];
        this.props.onChange(newFolderData, []);
        this.setState({ importFromGitHubDialogVisible: false });
    };

    render() {
        return (
            <>
                <Row>
                    <Col span={24}>
                        <Popconfirm
                            title='All the changes you did for the existing test cases will be deleted. Are you sure?'
                            onConfirm={this.handleStartNewFolder}
                            okText='Yes'
                            okButtonProps={{ type: 'danger' }}
                            cancelText='No'
                        >
                            <Button
                                type='primary'
                                danger
                            >
                Create a new folder
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
                {
                    this.props.ipcRenderer
                        ? (
                            <Row className='mt-2'>
                                <Col span={24}>
                                    <Button
                                        type='primary'
                                        onClick={() => {
                                            this.props.ipcRenderer.send('mainAction', JSON.stringify({ action: 'openFolder' }));
                                        }}
                                    >Open Folder
                                    </Button>
                                    <Button
                                        type='primary'
                                        className='float-right'
                                        danger
                                        onClick={() => {
                                            const nativeFilePath = localStorage.getItem('nativeFilePath');
                                            this.props.ipcRenderer.send('mainAction', JSON.stringify({ action: 'saveFolderData', data: this.props.folderData, nativeFilePath }));
                                        }}
                                    >Save
                                    </Button>
                                </Col>
                            </Row>
                        )
                        : (
                            <>
                                <Row className='mt-2'>
                                    <Col span={24}>
                                        <Popover
                                            content={
                                                <div style={{ width: '500px' }}>
                                                    <GitHubBrowser
                                                        onDownload={this.handleGitHubDownload}
                                                    />
                                                </div>
                                            }
                                            title='Select Files / Folders'
                                            trigger='click'
                                            visible={this.state.importFromGitHubDialogVisible}
                                            onVisibleChange={visible => {
                                                // if (visible) {
                                                //   this.setState({ renameEnvironmentNewName: this.state.localEnvironments[this.state.selectedEnvironmentIndex] && this.state.localEnvironments[this.state.selectedEnvironmentIndex].name })
                                                // }
                                                this.setState({ importFromGitHubDialogVisible: visible });
                                            }}
                                        >
                                            <Button
                                                className='ml-2 float-right'
                                                type='primary'
                                                shape='round'
                                                danger
                                            >
                        Import from Github <DownOutlined />
                                            </Button>
                                        </Popover>
                                    </Col>
                                </Row>
                                <Row className='mt-2'>
                                    <Col span={24}>
                                        <Button
                                            type='default'
                                            onClick={e => {
                                                e.preventDefault();
                                                this.collectionFileSelector.click();
                                            }}
                                        >
                      Import File
                                        </Button>
                                        <Button
                                            className='ml-2'
                                            size='default'
                                            onClick={e => {
                                                e.preventDefault();
                                                this.collectionFolderSelector.click();
                                            }}
                                        >
                      Import Folder
                                        </Button>
                                        <Button
                                            type='primary'
                                            className='ml-2'
                                            size='default'
                                            onClick={e => {
                                                e.preventDefault();
                                                this.handleExportFolder();
                                            }}
                                        >
                      Download as Zip file
                                        </Button>
                                    </Col>
                                </Row>
                            </>
                        )
                }
                <Row className='mt-2'>
                    <Col>
                        <FolderBrowser
                            folderData={this.props.folderData}
                            selectedFiles={this.props.selectedFiles}
                            labelsManager={this.props.labelsManager}
                            onSelect={this.handleSelectionChanged}
                            onOrderChange={this.handleOrderChange}
                            onAddFileOrFolder={this.handleAddFileOrFolder}
                            onDeleteFileOrFolder={this.handleDeleteFileOrFolder}
                            onDuplicateFileOrFolder={this.handleDuplicateFileOrFolder}
                            onRenameFileOrFolder={this.handleRenameFileOrFolder}
                            onMoveFileOrFolder={this.handleMoveFileOrFolder}
                            onPaste={this.handlePaste}
                            onPasteReference={this.handlePasteRef}
                        />
                    </Col>
                </Row>
            </>
        );
    }
}

export default FileManager;
