import React, { useState, useRef } from 'react';

const DEFAULT_TEX = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}

\\title{GlassTeX Editor}
\\author{Online Felhasználó}

\\begin{document}
\\maketitle

\\section{Bevezetés}
Ez a szerkesztő a TeX Live nyílt szerverét használja a háttérben a villámgyors PDF generálásra.

\\section{Matek teszt}
Így már a legbonyolultabb képletek is azonnal fordulnak:
$$ E = mc^2 $$

\\end{document}`;

export default function App() {
  const [texCode, setTexCode] = useState(DEFAULT_TEX);
  const [hasCompiled, setHasCompiled] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  
  const fileInputRef = useRef(null);
  const formRef = useRef(null); // Ez az új rejtett űrlapunk referenciája

  // Fájl letöltése memóriából
  const handleDownload = () => {
    const blob = new Blob([texCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dokumentum.tex';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fájl feltöltése
  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setTexCode(e.target.result);
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  // Build: A rejtett form elküldése az iframe-be
 const handleBuild = () => {
    setIsBuilding(true);
    setHasCompiled(true);
    
    // Egy kis késleltetés a renderelés előtt
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.submit();
      }
      setIsBuilding(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300 p-4 md:p-8 font-sans">
      
      <input type="file" accept=".tex" ref={fileInputRef} onChange={handleUpload} className="hidden" />

      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white/20 backdrop-blur-xl border border-white/40 shadow-lg rounded-2xl p-4 gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">
          FreeTex <span className="font-light text-gray-600">Editor</span>
        </h1>
        
        <div className="flex space-x-3">
          <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-white/30 hover:bg-white/50 border border-white/50 rounded-xl text-gray-800 text-sm font-medium transition-all shadow-sm">
            Feltöltés (.tex)
          </button>
          <button onClick={handleDownload} className="px-4 py-2 bg-white/30 hover:bg-white/50 border border-white/50 rounded-xl text-gray-800 text-sm font-medium transition-all shadow-sm">
            Mentés (.tex)
          </button>
          <button onClick={handleBuild} disabled={isBuilding} className={`px-6 py-2 rounded-xl text-white text-sm font-bold transition-all shadow-md ${isBuilding ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {isBuilding ? 'Fordítás...' : 'Build PDF'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 h-[75vh]">
        
        <div className="flex flex-col bg-white/20 backdrop-blur-xl border border-white/40 shadow-xl rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/30 bg-white/10">
            <span className="text-sm font-medium text-gray-700">document.tex</span>
          </div>
          <textarea
            value={texCode}
            onChange={(e) => setTexCode(e.target.value)}
            spellCheck="false"
            className="flex-1 w-full p-4 bg-transparent text-gray-900 font-mono text-sm focus:outline-none resize-none"
            placeholder="Írd ide a LaTeX kódot..."
          />
        </div>

        <div className="flex flex-col bg-white/20 backdrop-blur-xl border border-white/40 shadow-xl rounded-2xl overflow-hidden relative">
           <div className="px-4 py-2 border-b border-white/30 bg-white/10 flex justify-between">
            <span className="text-sm font-medium text-gray-700">Előnézet</span>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            
            {/* REJTETT ŰRLAP: Ez lövi fel a kódot az ingyenes TeX Live szerverre biztonságosan */}
            <form ref={formRef} action="https://texlive.net/cgi-bin/latexcgi" method="POST" target="pdfFrame" className="hidden">
              {/* A 'filename' mező kulcsfontosságú */}
              <input type="hidden" name="filename" value="document.tex" />
              <input type="hidden" name="engine" value="pdflatex" />
              <textarea name="filecontents">{texCode}</textarea>
            </form>

            {/* A kapott PDF egyenesen ide fog érkezni */}
            <iframe 
              name="pdfFrame"
              className={`w-full h-full rounded-xl bg-white shadow-inner ${!hasCompiled ? 'hidden' : 'block'}`}
              title="PDF Preview"
            />
            
            {!hasCompiled && (
              <div className="text-center text-gray-600/70">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p className="text-lg font-medium">Nincs generált PDF</p>
                <p className="text-sm mt-1">Kattints a Build gombra a fordításhoz!</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}