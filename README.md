# DICOM RT Metadata Reader

A pure front-end web application for reading and displaying DICOM RT (Radiotherapy) file metadata in the browser. This tool helps identify and organize RT Plan, RT Dose, and RT Structure files by displaying their key metadata tags.

## Features

- **Drag & Drop Upload**: Easy file upload via drag-and-drop or file browser
- **RT-Specific Tags**: Focused display of important RT metadata:
  - **General**: Patient ID, Study Date, Modality, Study Instance UID
  - **RT Plan**: RT Plan Name, SOP Instance UID, RT Plan Label, RT Plan Date, Referenced RT Plan Sequence
  - **RT Dose**: Referenced RT Plan Sequence
  - **RT Structure**: Frame of Reference UID, Referenced Frame of Reference Sequence
- **Tabbed Interface**: Organized display by metadata category
- **All Tags View**: Complete DICOM tag browser for advanced users
- **Modern UI**: Clean, responsive design

## Technology Stack

- **HTML5/CSS3/JavaScript**: Pure front-end, no backend required
- **dicomParser**: JavaScript library for parsing DICOM files in the browser
- **GitHub Pages Ready**: Static files that can be deployed directly

## Usage

1. Open `index.html` in a modern web browser
2. Drag and drop a DICOM file onto the upload area, or click to browse
3. View metadata in organized tabs:
   - **General**: Basic patient and study information
   - **RT Plan**: RT Plan specific metadata
   - **RT Dose**: RT Dose specific metadata
   - **RT Structure**: RT Structure specific metadata
   - **All Tags**: Complete DICOM tag browser

## Deployment to GitHub Pages

### Quick Setup:

1. **Create a new GitHub repository** (or use an existing one)
   ```bash
   git init
   git add .
   git commit -m "Initial commit: DICOM RT Metadata Reader"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Choose branch: **main** and folder: **/ (root)**
   - Click **Save**

3. **Access your app:**
   - Your app will be available at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
   - It may take a few minutes for the site to be available after first deployment

### Local Testing:

You can test the app locally by opening `index.html` in a web browser, or use a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Then open http://localhost:8000 in your browser
```

## File Structure

```
DicomMetatagReader/
├── index.html      # Main HTML file
├── styles.css      # Styling
├── app.js          # Application logic
└── README.md       # This file
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with FileReader API support

## Troubleshooting

### "dicomParser is not defined" Error

If you see this error, it means the dicomParser library failed to load. Try these solutions:

1. **Check Internet Connection**: The app loads dicomParser from a CDN, so you need an internet connection.

2. **Download Library Locally** (Works offline):
   - Download: https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.min.js
   - Save it as `dicomParser.min.js` in the `DicomMetatagReader` folder
   - Update `index.html` line 87, change:
     ```html
     <script src="https://unpkg.com/dicom-parser@1.8.22/dist/dicomParser.min.js"></script>
     ```
     to:
     ```html
     <script src="dicomParser.min.js"></script>
     ```

3. **Use a Local Web Server**: If opening `index.html` directly (file://), some browsers may block CDN scripts. Use a local server instead:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Then open http://localhost:8000
   ```

## Notes

- Files are processed entirely in the browser - no data is sent to any server
- Large DICOM files may take a moment to process
- The application uses the dicomParser library (loaded from CDN or locally)

## License

This is a utility tool for medical imaging file analysis. Use responsibly and ensure compliance with HIPAA and other relevant regulations when handling patient data.
