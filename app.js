// Check if dicomParser is loaded
if (typeof dicomParser === 'undefined') {
    console.error('dicomParser library not loaded. Please check the script tag in index.html');
    document.addEventListener('DOMContentLoaded', function() {
        const errorMsg = document.getElementById('errorMessage');
        if (errorMsg) {
            errorMsg.textContent = 'Error: dicomParser library failed to load. Please check your internet connection or try refreshing the page.';
            errorMsg.style.display = 'block';
        }
    });
}

// DICOM Tag definitions for RT files
const DICOM_TAGS = {
    // General tags
    PatientID: { tag: '00100020', name: 'Patient ID' },
    StudyDate: { tag: '00080020', name: 'Study Date' },
    Modality: { tag: '00080060', name: 'Modality' },
    StudyInstanceUID: { tag: '0020000D', name: 'Study Instance UID' },
    
    // RT Plan tags
    SOPInstanceUID: { tag: '00080018', name: 'SOP Instance UID' },
    RTPlanLabel: { tag: '300A0002', name: 'RT Plan Label' },
    RTPlanName: { tag: '300A0003', name: 'RT Plan Name' },
    RTPlanDate: { tag: '300A0006', name: 'RT Plan Date' },
    ReferencedRTPlanSequence: { tag: '300C0002', name: 'Referenced RT Plan Sequence' },
    
    // RT Dose tags
    ReferencedRTPlanSequence_Dose: { tag: '300C0002', name: 'Referenced RT Plan Sequence' },
    
    // RT Structure tags
    FrameOfReferenceUID: { tag: '00200052', name: 'Frame of Reference UID' },
    ReferencedFrameOfReferenceSequence: { tag: '30060010', name: 'Referenced Frame of Reference Sequence' }
};

// Helper function to get tag value
function getTagValue(dataset, tag) {
    try {
        // Normalize tag (uppercase, remove spaces/dashes)
        const normalizedTag = tag.toUpperCase().replace(/[\s-]/g, '');
        // Convert tag string to proper format (e.g., '00100020' -> 'x00100020')
        const tagKey = 'x' + normalizedTag;
        let element = dataset.elements[tagKey];
        
        // If not found, try lowercase (some parsers use lowercase)
        if (!element) {
            const tagKeyLower = 'x' + normalizedTag.toLowerCase();
            element = dataset.elements[tagKeyLower];
        }
        
        // If still not found, try to find by iterating (case-insensitive search)
        if (!element) {
            const searchKey = normalizedTag.toLowerCase();
            for (const key in dataset.elements) {
                if (key.toLowerCase() === 'x' + searchKey) {
                    element = dataset.elements[key];
                    break;
                }
            }
        }
        
        if (!element) {
            return null;
        }
        
        if (element.vr === 'SQ') {
            // Sequence - read sequence items
            const sequenceItems = [];
            if (element.items && element.items.length > 0) {
                element.items.forEach((item, index) => {
                    const itemData = {};
                    // Read common sequence item tags
                    if (item.dataSet) {
                        // Try to read ReferencedSOPInstanceUID (tag 0008,1155)
                        const refSOPInstanceTag = item.dataSet.elements['x00081155'];
                        if (refSOPInstanceTag) {
                            try {
                                itemData.ReferencedSOPInstanceUID = dicomParser.readTag(item.dataSet, 'x00081155');
                            } catch (e) {
                                // Fallback to raw reading
                                itemData.ReferencedSOPInstanceUID = readRawTagValue(item.dataSet, refSOPInstanceTag);
                            }
                        }
                        // Try to read ReferencedSOPClassUID (tag 0008,1150)
                        const refSOPClassTag = item.dataSet.elements['x00081150'];
                        if (refSOPClassTag) {
                            try {
                                itemData.ReferencedSOPClassUID = dicomParser.readTag(item.dataSet, 'x00081150');
                            } catch (e) {
                                itemData.ReferencedSOPClassUID = readRawTagValue(item.dataSet, refSOPClassTag);
                            }
                        }
                        // For ReferencedRTPlanSequence, check for ReferencedSOPInstanceUID at 300C,0006
                        const rtPlanRefTag = item.dataSet.elements['x300C0006'];
                        if (rtPlanRefTag) {
                            try {
                                const uid = dicomParser.readTag(item.dataSet, 'x300C0006');
                                if (uid) itemData.ReferencedSOPInstanceUID = uid;
                            } catch (e) {
                                const uid = readRawTagValue(item.dataSet, rtPlanRefTag);
                                if (uid) itemData.ReferencedSOPInstanceUID = uid;
                            }
                        }
                        // For ReferencedStructureSetSequence (300C,0060), check for ReferencedSOPInstanceUID at 300C,0006
                        const structRefTag = item.dataSet.elements['x300C0006'];
                        if (structRefTag && !itemData.ReferencedSOPInstanceUID) {
                            try {
                                const uid = dicomParser.readTag(item.dataSet, 'x300C0006');
                                if (uid) itemData.ReferencedSOPInstanceUID = uid;
                            } catch (e) {
                                const uid = readRawTagValue(item.dataSet, structRefTag);
                                if (uid) itemData.ReferencedSOPInstanceUID = uid;
                            }
                        }
                        // For ReferencedFrameOfReferenceSequence, check for FrameOfReferenceUID at 0020,0052
                        const frameRefTag = item.dataSet.elements['x00200052'];
                        if (frameRefTag) {
                            try {
                                itemData.FrameOfReferenceUID = dicomParser.readTag(item.dataSet, 'x00200052');
                            } catch (e) {
                                itemData.FrameOfReferenceUID = readRawTagValue(item.dataSet, frameRefTag);
                            }
                        }
                    }
                    if (Object.keys(itemData).length > 0) {
                        sequenceItems.push(itemData);
                    } else {
                        sequenceItems.push(`Sequence Item ${index + 1} (no readable tags)`);
                    }
                });
            }
            return sequenceItems.length > 0 ? sequenceItems : null;
        } else {
            // Regular tag - read value using dicomParser API
            try {
                // Use the actual tag key found in the dataset (might be different case)
                const actualTagKey = Object.keys(dataset.elements).find(k => 
                    k.toLowerCase() === tagKey.toLowerCase()
                ) || tagKey;
                
                const value = dicomParser.readTag(dataset, actualTagKey);
                // Handle different value types
                if (value === undefined || value === null) {
                    // Try reading raw bytes as fallback
                    return readRawTagValue(dataset, element);
                }
                // Trim whitespace for string values
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    return trimmed.length > 0 ? trimmed : null;
                }
                return value;
            } catch (readError) {
                // If readTag fails, try reading the raw bytes directly
                return readRawTagValue(dataset, element);
            }
        }
    } catch (e) {
        console.error('Error reading tag ' + tag + ':', e);
        return null;
    }
}

// Helper function to read raw tag value from bytes
function readRawTagValue(dataset, element) {
    try {
        if (element.length > 0 && element.dataOffset !== undefined && dataset.byteArray) {
            const byteArray = new Uint8Array(dataset.byteArray.buffer, element.dataOffset, element.length);
            
            // For string VR types, convert to string
            if (element.vr === 'AE' || element.vr === 'AS' || element.vr === 'AT' || 
                element.vr === 'CS' || element.vr === 'DA' || element.vr === 'DS' || 
                element.vr === 'DT' || element.vr === 'IS' || element.vr === 'LO' || 
                element.vr === 'LT' || element.vr === 'PN' || element.vr === 'SH' || 
                element.vr === 'ST' || element.vr === 'TM' || element.vr === 'UI' || 
                element.vr === 'UT') {
                const decoder = new TextDecoder('latin1');
                const decoded = decoder.decode(byteArray).trim().replace(/\0/g, '');
                return decoded.length > 0 ? decoded : null;
            }
            // For numeric types, decode as string for display
            if (element.vr === 'SL' || element.vr === 'SS' || element.vr === 'UL' || element.vr === 'US' ||
                element.vr === 'FL' || element.vr === 'FD') {
                const decoder = new TextDecoder('latin1');
                const decoded = decoder.decode(byteArray).trim().replace(/\0/g, '');
                return decoded.length > 0 ? decoded : null;
            }
            // For other types, try to decode as string
            try {
                const decoder = new TextDecoder('latin1');
                const decoded = decoder.decode(byteArray).trim().replace(/\0/g, '');
                return decoded.length > 0 ? decoded : null;
            } catch (e) {
                return null;
            }
        }
    } catch (e2) {
        console.warn('Error reading raw tag value:', e2);
    }
    return null;
}

// Format tag value for display
function formatTagValue(value) {
    if (value === null || value === undefined) {
        return '<span style="color: #999; font-style: italic;">Not available</span>';
    }
    
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '<span style="color: #999; font-style: italic;">Empty sequence</span>';
        }
        return value.map((item, idx) => {
            if (typeof item === 'object') {
                let html = `<div class="sequence-item"><strong>Item ${idx + 1}:</strong><br>`;
                for (const key in item) {
                    html += `${key}: ${item[key]}<br>`;
                }
                html += '</div>';
                return html;
            }
            return `<div class="sequence-item">Item ${idx + 1}: ${item}</div>`;
        }).join('');
    }
    
    if (typeof value === 'object') {
        let html = '<div class="sequence-item">';
        for (const key in value) {
            html += `<strong>${key}:</strong> ${value[key]}<br>`;
        }
        html += '</div>';
        return html;
    }
    
    return String(value);
}

// Create metadata item element
function createMetadataItem(label, value, tag = null, highlight = false) {
    const item = document.createElement('div');
    item.className = 'metadata-item' + (highlight ? ' highlight' : '');
    
    let html = `<div class="metadata-label">${label}</div>`;
    html += `<div class="metadata-value">${formatTagValue(value)}</div>`;
    if (tag) {
        const group = tag.substring(0, 4);
        const element = tag.substring(4);
        html += `<div class="metadata-tag">Tag: (${group}, ${element})</div>`;
    }
    
    item.innerHTML = html;
    return item;
}

// Display general metadata
function displayGeneralMetadata(dataset) {
    const container = document.getElementById('generalMetadata');
    container.innerHTML = '';
    
    const tags = [
        { key: 'PatientID', tag: DICOM_TAGS.PatientID },
        { key: 'StudyDate', tag: DICOM_TAGS.StudyDate },
        { key: 'Modality', tag: DICOM_TAGS.Modality },
        { key: 'StudyInstanceUID', tag: DICOM_TAGS.StudyInstanceUID }
    ];
    
    tags.forEach(({ key, tag }) => {
        const value = getTagValue(dataset, tag.tag);
        const item = createMetadataItem(tag.name, value, tag.tag);
        container.appendChild(item);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-message">No general metadata available</div>';
    }
}

// Display RT Plan metadata
function displayRTPlanMetadata(dataset) {
    const container = document.getElementById('rtplanMetadata');
    container.innerHTML = '';
    
    const modality = getTagValue(dataset, DICOM_TAGS.Modality.tag);
    
    if (modality !== 'RTPLAN') {
        container.innerHTML = '<div class="empty-message">This file is not an RT Plan. Modality: ' + (modality || 'Unknown') + '</div>';
        return;
    }
    
    const tags = [
        { key: 'SOPInstanceUID', tag: DICOM_TAGS.SOPInstanceUID },
        { key: 'RTPlanLabel', tag: DICOM_TAGS.RTPlanLabel },
        { key: 'RTPlanName', tag: DICOM_TAGS.RTPlanName },
        { key: 'RTPlanDate', tag: DICOM_TAGS.RTPlanDate },
        { key: 'ReferencedRTPlanSequence', tag: DICOM_TAGS.ReferencedRTPlanSequence }
    ];
    
    tags.forEach(({ key, tag }) => {
        const value = getTagValue(dataset, tag.tag);
        const item = createMetadataItem(tag.name, value, tag.tag);
        container.appendChild(item);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-message">No RT Plan metadata available</div>';
    }
}

// Display RT Dose metadata
function displayRTDoseMetadata(dataset) {
    const container = document.getElementById('rtdoseMetadata');
    container.innerHTML = '';
    
    const modality = getTagValue(dataset, DICOM_TAGS.Modality.tag);
    
    if (modality !== 'RTDOSE') {
        container.innerHTML = '<div class="empty-message">This file is not an RT Dose. Modality: ' + (modality || 'Unknown') + '</div>';
        return;
    }
    
    const value = getTagValue(dataset, DICOM_TAGS.ReferencedRTPlanSequence_Dose.tag);
    const item = createMetadataItem(DICOM_TAGS.ReferencedRTPlanSequence_Dose.name, value, DICOM_TAGS.ReferencedRTPlanSequence_Dose.tag);
    container.appendChild(item);
    
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-message">No RT Dose metadata available</div>';
    }
}

// Display RT Structure metadata
function displayRTStructMetadata(dataset) {
    const container = document.getElementById('rtstructMetadata');
    container.innerHTML = '';
    
    const modality = getTagValue(dataset, DICOM_TAGS.Modality.tag);
    
    if (modality !== 'RTSTRUCT') {
        container.innerHTML = '<div class="empty-message">This file is not an RT Structure. Modality: ' + (modality || 'Unknown') + '</div>';
        return;
    }
    
    const tags = [
        { key: 'FrameOfReferenceUID', tag: DICOM_TAGS.FrameOfReferenceUID },
        { key: 'ReferencedFrameOfReferenceSequence', tag: DICOM_TAGS.ReferencedFrameOfReferenceSequence }
    ];
    
    tags.forEach(({ key, tag }) => {
        const value = getTagValue(dataset, tag.tag);
        const item = createMetadataItem(tag.name, value, tag.tag);
        container.appendChild(item);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-message">No RT Structure metadata available</div>';
    }
}

// DICOM Tag Name Dictionary (common tags)
const TAG_NAMES = {
    '00020000': 'File Meta Information Group Length',
    '00020001': 'File Meta Information Version',
    '00020002': 'Media Storage SOP Class UID',
    '00020003': 'Media Storage SOP Instance UID',
    '00020010': 'Transfer Syntax UID',
    '00020012': 'Implementation Class UID',
    '00020013': 'Implementation Version Name',
    '00080005': 'Specific Character Set',
    '00080012': 'Instance Creation Date',
    '00080013': 'Instance Creation Time',
    '00080016': 'SOP Class UID',
    '00080018': 'SOP Instance UID',
    '00080020': 'Study Date',
    '00080021': 'Series Date',
    '00080023': 'Content Date',
    '00080030': 'Study Time',
    '00080031': 'Series Time',
    '00080033': 'Content Time',
    '00080050': 'Accession Number',
    '00080060': 'Modality',
    '00080070': 'Manufacturer',
    '00080090': 'Referring Physician Name',
    '00081010': 'Station Name',
    '00081100': 'Coding Scheme Identification Sequence',
    '00081110': 'Coding Scheme Identification Sequence',
    '00081230': 'Coding Scheme Name',
    '00081240': 'Coding Scheme Responsible Organization',
    '00081030': 'Study Description',
    '0008103E': 'Series Description',
    '00081048': 'Physician(s) of Record',
    '00081070': 'Operator Name',
    '00081090': 'Manufacturer Model Name',
    '00100010': 'Patient Name',
    '00100020': 'Patient ID',
    '00100030': 'Patient Birth Date',
    '00100032': 'Patient Birth Time',
    '00100040': 'Patient Sex',
    '00101000': 'Other Patient IDs',
    '00180050': 'Slice Thickness',
    '00181000': 'Device Serial Number',
    '00181020': 'Software Version(s)',
    '0020000D': 'Study Instance UID',
    '0020000E': 'Series Instance UID',
    '00200010': 'Study ID',
    '00200011': 'Series Number',
    '00200032': 'Image Position (Patient)',
    '00200037': 'Image Orientation (Patient)',
    '00200052': 'Frame of Reference UID',
    '00201040': 'Slice Location',
    '30060002': 'Structure Set Label',
    '30060004': 'Structure Set Name',
    '30060008': 'Structure Set Date',
    '30060009': 'Structure Set Time',
    '30060010': 'Referenced Frame of Reference Sequence',
    '30060020': 'Structure Set ROI Sequence',
    '30060039': 'ROI Contour Sequence',
    '30060080': 'RT ROI Observations Sequence',
    '300E0002': 'Approval Status',
    '300E0004': 'Review Date',
    '300E0005': 'Review Time',
    '300E0008': 'Reviewer Name',
    '00280002': 'Samples per Pixel',
    '00280004': 'Photometric Interpretation',
    '00280008': 'Number of Frames',
    '00280009': 'Frame Increment Pointer',
    '00280010': 'Rows',
    '00280011': 'Columns',
    '00280030': 'Pixel Spacing',
    '00280100': 'Bits Allocated',
    '00280101': 'Bits Stored',
    '00280102': 'High Bit',
    '00280103': 'Pixel Representation',
    '30040002': 'Dose Units',
    '30040004': 'Dose Type',
    '3004000A': 'Dose Summation Type',
    '3004000C': 'Grid Frame Offset Vector',
    '3004000E': 'Dose Grid Scaling',
    '30040014': 'Dose Comment',
    '30040050': 'Structure Set Label',
    '300C0002': 'Referenced RT Plan Sequence',
    '300C0006': 'Referenced SOP Instance UID',
    '300C0060': 'Referenced Structure Set Sequence',
    '30060010': 'Referenced Frame of Reference Sequence',
    '7FE00010': 'Pixel Data'
};

// Get tag name from dictionary
function getTagName(tag) {
    // Normalize tag (remove spaces, ensure uppercase)
    const normalizedTag = tag.toUpperCase().replace(/\s/g, '');
    
    // Check our dictionary
    if (TAG_NAMES[normalizedTag]) {
        return TAG_NAMES[normalizedTag];
    }
    
    // Try to use dicomParser's tag dictionary if available
    try {
        if (typeof dicomParser !== 'undefined' && dicomParser.tagDictionary) {
            const tagKey = 'x' + normalizedTag;
            const tagInfo = dicomParser.tagDictionary[tagKey];
            if (tagInfo && tagInfo.name) {
                return tagInfo.name;
            }
        }
    } catch (e) {
        // Ignore
    }
    
    return null;
}

// Display all tags
function displayAllMetadata(dataset) {
    const container = document.getElementById('allMetadata');
    
    let html = '<table><thead><tr><th class="tag-col">Tag</th><th class="name-col">Name</th><th class="value-col">Value</th></tr></thead><tbody>';
    
    // Sort tags by group and element
    const sortedTags = Object.keys(dataset.elements).sort();
    
    sortedTags.forEach(tag => {
        const element = dataset.elements[tag];
        // Remove 'x' prefix and format as (GGGG, EEEE)
        const tagWithoutX = tag.substring(1);
        const group = tagWithoutX.substring(0, 4);
        const element_hex = tagWithoutX.substring(4);
        const tagFormatted = `(${group}, ${element_hex})`;
        
        // Get tag name
        let name = element.name || getTagName(tagWithoutX) || 'Unknown';
        let value = '';
        
        try {
            if (element.vr === 'SQ') {
                // Try to parse sequence and show referenced UIDs
                const seqValue = getTagValue(dataset, tagWithoutX);
                if (seqValue && Array.isArray(seqValue) && seqValue.length > 0) {
                    // Format sequence items
                    value = seqValue.map((item, idx) => {
                        if (typeof item === 'object') {
                            const parts = [];
                            if (item.ReferencedSOPInstanceUID) {
                                parts.push('UID: ' + item.ReferencedSOPInstanceUID);
                            }
                            if (item.ReferencedSOPClassUID) {
                                parts.push('Class: ' + item.ReferencedSOPClassUID);
                            }
                            if (item.FrameOfReferenceUID) {
                                parts.push('FOR UID: ' + item.FrameOfReferenceUID);
                            }
                            return parts.length > 0 ? 'Item ' + (idx + 1) + ': ' + parts.join(', ') : 'Item ' + (idx + 1);
                        }
                        return String(item);
                    }).join('; ');
                    if (value.length > 150) {
                        value = value.substring(0, 150) + '...';
                    }
                } else {
                    value = '[Sequence - ' + (element.items ? element.items.length : 0) + ' items]';
                }
            } else if (element.vr === 'OB' || element.vr === 'OW' || element.vr === 'OF') {
                value = '[Binary Data - ' + element.length + ' bytes]';
            } else if (element.vr === 'UN') {
                // Unknown VR - might be a sequence or other encoded data
                // Check if it looks like a sequence by trying to parse it
                try {
                    const tagValue = getTagValue(dataset, tagWithoutX);
                    if (tagValue && (Array.isArray(tagValue) || typeof tagValue === 'object')) {
                        value = String(tagValue);
                        if (value.length > 100) {
                            value = value.substring(0, 100) + '...';
                        }
                    } else {
                        value = '[Unknown VR - ' + element.length + ' bytes]';
                    }
                } catch (e) {
                    value = '[Unknown VR - ' + element.length + ' bytes]';
                }
            } else if (tagWithoutX === '7FE00010') {
                // Pixel Data - always show as binary
                value = '[Pixel Data - ' + element.length + ' bytes]';
            } else {
                // Use getTagValue to read the value consistently
                const tagValue = getTagValue(dataset, tagWithoutX);
                if (tagValue !== null && tagValue !== undefined) {
                    value = String(tagValue);
                    // Check if it looks like binary/encoded data (contains non-printable chars)
                    if (/[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(value) && value.length > 50) {
                        // Likely binary data, show summary
                        const printable = value.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, '');
                        if (printable.length < value.length * 0.3) {
                            // More than 70% non-printable, treat as binary
                            value = '[Binary/Encoded Data - ' + element.length + ' bytes]';
                        } else {
                            // Some printable content, show it but truncate
                            if (value.length > 100) {
                                value = value.substring(0, 100) + '...';
                            }
                        }
                    } else if (value.length > 100) {
                        value = value.substring(0, 100) + '...';
                    }
                } else {
                    value = '[Unable to read value]';
                }
            }
        } catch (e) {
            value = '[Error reading value]';
        }
        
        html += `<tr><td class="tag-col">${tagFormatted}</td><td class="name-col">${name}</td><td class="value-col">${value || ''}</td></tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Process DICOM file
function processDICOMFile(file) {
    // Check if dicomParser is available
    if (typeof dicomParser === 'undefined') {
        document.getElementById('errorMessage').textContent = 'Error: dicomParser library is not loaded. Please refresh the page and try again.';
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const byteArray = new Uint8Array(arrayBuffer);
            
            // Parse DICOM file
            const dataset = dicomParser.parseDicom(byteArray);
            
            // Verify dataset was parsed correctly
            if (!dataset || !dataset.elements) {
                throw new Error('Failed to parse DICOM file. The file may not be a valid DICOM file.');
            }
            
            console.log('DICOM file parsed successfully. Number of elements:', Object.keys(dataset.elements).length);
            
            // Display file info
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            document.getElementById('fileInfo').style.display = 'block';
            
            // Display metadata
            displayGeneralMetadata(dataset);
            displayRTPlanMetadata(dataset);
            displayRTDoseMetadata(dataset);
            displayRTStructMetadata(dataset);
            displayAllMetadata(dataset);
            
            // Show metadata section
            document.getElementById('metadataSection').style.display = 'block';
            document.getElementById('errorMessage').style.display = 'none';
            document.getElementById('loading').style.display = 'none';
            document.getElementById('clearBtn').style.display = 'block';
            
        } catch (error) {
            console.error('Error parsing DICOM:', error);
            console.error('Error stack:', error.stack);
            document.getElementById('errorMessage').textContent = 'Error reading DICOM file: ' + error.message + '. Please ensure the file is a valid DICOM file.';
            document.getElementById('errorMessage').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
        }
    };
    
    reader.onerror = function() {
        document.getElementById('errorMessage').textContent = 'Error reading file';
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
    };
    
    reader.readAsArrayBuffer(file);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('tab-' + tabName).classList.add('active');
        });
    });
    
    // Browse button - stop propagation to prevent drop zone click
    browseBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent drop zone click from firing
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    // Drag and drop
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    // Click to browse
    dropZone.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Clear button
    clearBtn.addEventListener('click', function() {
        // Reset everything
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('metadataSection').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('clearBtn').style.display = 'none';
        fileInput.value = '';
        
        // Reset to first tab
        tabButtons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        tabButtons[0].classList.add('active');
        document.getElementById('tab-general').classList.add('active');
    });
    
    function handleFile(file) {
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.dcm') && 
            !file.name.toLowerCase().endsWith('.dicom') &&
            file.type !== 'application/dicom') {
            document.getElementById('errorMessage').textContent = 'Please select a DICOM file (.dcm or .dicom)';
            document.getElementById('errorMessage').style.display = 'block';
            return;
        }
        
        document.getElementById('loading').style.display = 'block';
        document.getElementById('errorMessage').style.display = 'none';
        
        processDICOMFile(file);
    }
});
