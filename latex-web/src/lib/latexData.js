// Static LaTeX knowledge used for autocompletion, the toolbar and the symbol palette.
// Snippets use CodeMirror snippet syntax: ${name} placeholders, ${} for the cursor.

export const COMMANDS = [
  // Document structure
  ['\\documentclass', '\\documentclass[${}]{${article}}', 'Document class'],
  ['\\usepackage', '\\usepackage{${}}', 'Load package'],
  ['\\usepackage[]', '\\usepackage[${options}]{${package}}', 'Load package with options'],
  ['\\title', '\\title{${}}'], ['\\author', '\\author{${}}'], ['\\date', '\\date{${\\today}}'],
  ['\\maketitle'], ['\\tableofcontents'], ['\\listoffigures'], ['\\listoftables'],
  ['\\part', '\\part{${}}'], ['\\chapter', '\\chapter{${}}'], ['\\chapter*', '\\chapter*{${}}'],
  ['\\section', '\\section{${}}'], ['\\section*', '\\section*{${}}'],
  ['\\subsection', '\\subsection{${}}'], ['\\subsection*', '\\subsection*{${}}'],
  ['\\subsubsection', '\\subsubsection{${}}'], ['\\paragraph', '\\paragraph{${}}'], ['\\subparagraph', '\\subparagraph{${}}'],
  ['\\appendix'], ['\\frontmatter'], ['\\mainmatter'], ['\\backmatter'],
  ['\\input', '\\input{${}}', 'Insert file'], ['\\include', '\\include{${}}', 'Include file (new page)'], ['\\includeonly', '\\includeonly{${}}'],
  ['\\newpage'], ['\\clearpage'], ['\\cleardoublepage'], ['\\pagebreak'], ['\\linebreak'], ['\\newline'], ['\\noindent'],
  ['\\label', '\\label{${}}', 'Label'], ['\\ref', '\\ref{${}}', 'Reference'], ['\\eqref', '\\eqref{${}}'], ['\\pageref', '\\pageref{${}}'],
  ['\\autoref', '\\autoref{${}}'], ['\\cref', '\\cref{${}}'], ['\\Cref', '\\Cref{${}}'], ['\\nameref', '\\nameref{${}}'],
  ['\\cite', '\\cite{${}}', 'Citation'], ['\\citep', '\\citep{${}}'], ['\\citet', '\\citet{${}}'], ['\\parencite', '\\parencite{${}}'],
  ['\\textcite', '\\textcite{${}}'], ['\\autocite', '\\autocite{${}}'], ['\\footcite', '\\footcite{${}}'], ['\\nocite', '\\nocite{${*}}'],
  ['\\bibliography', '\\bibliography{${}}'], ['\\bibliographystyle', '\\bibliographystyle{${plain}}'],
  ['\\addbibresource', '\\addbibresource{${}}'], ['\\printbibliography'],
  ['\\footnote', '\\footnote{${}}'], ['\\marginpar', '\\marginpar{${}}'], ['\\caption', '\\caption{${}}'],
  ['\\item'], ['\\item[]', '\\item[${}] '],
  // Text formatting
  ['\\textbf', '\\textbf{${}}', 'Bold'], ['\\textit', '\\textit{${}}', 'Italic'], ['\\emph', '\\emph{${}}', 'Emphasis'],
  ['\\underline', '\\underline{${}}'], ['\\texttt', '\\texttt{${}}', 'Monospace'], ['\\textsc', '\\textsc{${}}', 'Small caps'],
  ['\\textsf', '\\textsf{${}}'], ['\\textrm', '\\textrm{${}}'], ['\\textsl', '\\textsl{${}}'], ['\\textup', '\\textup{${}}'],
  ['\\textsuperscript', '\\textsuperscript{${}}'], ['\\textsubscript', '\\textsubscript{${}}'], ['\\textcolor', '\\textcolor{${red}}{${}}'],
  ['\\colorbox', '\\colorbox{${yellow}}{${}}'], ['\\url', '\\url{${}}'], ['\\href', '\\href{${url}}{${text}}'],
  ['\\tiny'], ['\\scriptsize'], ['\\footnotesize'], ['\\small'], ['\\normalsize'], ['\\large'], ['\\Large'], ['\\LARGE'], ['\\huge'], ['\\Huge'],
  ['\\bfseries'], ['\\itshape'], ['\\ttfamily'], ['\\centering'], ['\\raggedright'], ['\\raggedleft'],
  ['\\hspace', '\\hspace{${1cm}}'], ['\\vspace', '\\vspace{${1cm}}'], ['\\hfill'], ['\\vfill'], ['\\smallskip'], ['\\medskip'], ['\\bigskip'],
  ['\\LaTeX'], ['\\TeX'], ['\\today'], ['\\ldots'], ['\\dots'], ['\\quad'], ['\\qquad'],
  // Floats & graphics
  ['\\includegraphics', '\\includegraphics[width=${0.8}\\linewidth]{${}}', 'Insert image'],
  ['\\graphicspath', '\\graphicspath{{${images/}}}'], ['\\hline'], ['\\toprule'], ['\\midrule'], ['\\bottomrule'],
  ['\\cline', '\\cline{${1-2}}'], ['\\multicolumn', '\\multicolumn{${2}}{${c}}{${}}'], ['\\multirow', '\\multirow{${2}}{*}{${}}'],
  // Definitions
  ['\\newcommand', '\\newcommand{\\${name}}[${1}]{${}}'], ['\\renewcommand', '\\renewcommand{\\${name}}{${}}'],
  ['\\newenvironment', '\\newenvironment{${name}}{${}}{${}}'], ['\\DeclareMathOperator', '\\DeclareMathOperator{\\${name}}{${}}'],
  ['\\newtheorem', '\\newtheorem{${theorem}}{${Theorem}}'], ['\\setlength', '\\setlength{\\${parindent}}{${0pt}}'],
  ['\\setcounter', '\\setcounter{${}}{${}}'], ['\\pagestyle', '\\pagestyle{${plain}}'], ['\\thispagestyle', '\\thispagestyle{${empty}}'],
  ['\\pagenumbering', '\\pagenumbering{${arabic}}'], ['\\geometry', '\\geometry{${margin=2.5cm}}'], ['\\hypersetup', '\\hypersetup{${colorlinks=true}}'],
  // Math
  ['\\frac', '\\frac{${}}{${}}', 'Fraction'], ['\\dfrac', '\\dfrac{${}}{${}}'], ['\\tfrac', '\\tfrac{${}}{${}}'],
  ['\\sqrt', '\\sqrt{${}}', 'Square root'], ['\\sqrt[]', '\\sqrt[${n}]{${}}'], ['\\sum', '\\sum_{${i=1}}^{${n}}'], ['\\prod', '\\prod_{${i=1}}^{${n}}'],
  ['\\int', '\\int_{${a}}^{${b}}'], ['\\iint'], ['\\iiint'], ['\\oint'], ['\\lim', '\\lim_{${x \\to \\infty}}'],
  ['\\infty'], ['\\partial'], ['\\nabla'], ['\\cdot'], ['\\cdots'], ['\\vdots'], ['\\ddots'], ['\\times'], ['\\div'], ['\\pm'], ['\\mp'],
  ['\\leq'], ['\\geq'], ['\\neq'], ['\\approx'], ['\\equiv'], ['\\sim'], ['\\simeq'], ['\\cong'], ['\\propto'], ['\\ll'], ['\\gg'],
  ['\\in'], ['\\notin'], ['\\subset'], ['\\subseteq'], ['\\supset'], ['\\supseteq'], ['\\cup'], ['\\cap'], ['\\setminus'], ['\\emptyset'],
  ['\\forall'], ['\\exists'], ['\\neg'], ['\\land'], ['\\lor'], ['\\implies'], ['\\iff'], ['\\to'], ['\\mapsto'],
  ['\\rightarrow'], ['\\leftarrow'], ['\\Rightarrow'], ['\\Leftarrow'], ['\\leftrightarrow'], ['\\Leftrightarrow'],
  ['\\mathbb', '\\mathbb{${}}'], ['\\mathcal', '\\mathcal{${}}'], ['\\mathbf', '\\mathbf{${}}'], ['\\mathrm', '\\mathrm{${}}'],
  ['\\mathit', '\\mathit{${}}'], ['\\mathsf', '\\mathsf{${}}'], ['\\mathfrak', '\\mathfrak{${}}'], ['\\boldsymbol', '\\boldsymbol{${}}'],
  ['\\text', '\\text{${}}'], ['\\operatorname', '\\operatorname{${}}'], ['\\hat', '\\hat{${}}'], ['\\bar', '\\bar{${}}'], ['\\vec', '\\vec{${}}'],
  ['\\tilde', '\\tilde{${}}'], ['\\dot', '\\dot{${}}'], ['\\ddot', '\\ddot{${}}'], ['\\overline', '\\overline{${}}'], ['\\underbrace', '\\underbrace{${}}_{${}}'],
  ['\\overbrace', '\\overbrace{${}}^{${}}'], ['\\left(', '\\left( ${} \\right)'], ['\\left[', '\\left[ ${} \\right]'], ['\\left\\{', '\\left\\\\{ ${} \\right\\\\}'],
  ['\\binom', '\\binom{${n}}{${k}}'], ['\\sin'], ['\\cos'], ['\\tan'], ['\\log'], ['\\ln'], ['\\exp'], ['\\max'], ['\\min'], ['\\det'],
  ['\\alpha'], ['\\beta'], ['\\gamma'], ['\\delta'], ['\\epsilon'], ['\\varepsilon'], ['\\zeta'], ['\\eta'], ['\\theta'], ['\\vartheta'],
  ['\\iota'], ['\\kappa'], ['\\lambda'], ['\\mu'], ['\\nu'], ['\\xi'], ['\\pi'], ['\\rho'], ['\\sigma'], ['\\tau'], ['\\upsilon'],
  ['\\phi'], ['\\varphi'], ['\\chi'], ['\\psi'], ['\\omega'], ['\\Gamma'], ['\\Delta'], ['\\Theta'], ['\\Lambda'], ['\\Xi'], ['\\Pi'],
  ['\\Sigma'], ['\\Phi'], ['\\Psi'], ['\\Omega'], ['\\tag', '\\tag{${}}'], ['\\notag'], ['\\nonumber'], ['\\displaystyle'],
  // Beamer
  ['\\frametitle', '\\frametitle{${}}'], ['\\usetheme', '\\usetheme{${Madrid}}'], ['\\usecolortheme', '\\usecolortheme{${}}'], ['\\pause'], ['\\titlepage'],
];

export const ENVIRONMENTS = [
  'document', 'abstract', 'itemize', 'enumerate', 'description', 'figure', 'figure*', 'table', 'table*', 'tabular', 'tabularx',
  'longtable', 'center', 'flushleft', 'flushright', 'quote', 'quotation', 'verse', 'verbatim', 'minipage', 'equation', 'equation*',
  'align', 'align*', 'aligned', 'gather', 'gather*', 'multline', 'split', 'cases', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'array',
  'theorem', 'lemma', 'proof', 'definition', 'corollary', 'proposition', 'remark', 'example', 'frame', 'block', 'columns', 'column',
  'tikzpicture', 'axis', 'lstlisting', 'minted', 'subfigure', 'thebibliography', 'titlepage', 'appendices', 'wrapfigure', 'algorithm',
  'algorithmic', 'comment', 'multicols',
];

// Extra body inserted when an environment is completed.
export const ENV_BODIES = {
  itemize: '\t\\item ${}',
  enumerate: '\t\\item ${}',
  description: '\t\\item[${label}] ${}',
  figure: '\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${file}}\n\t\\caption{${caption}}\n\t\\label{fig:${label}}',
  table: '\t\\centering\n\t\\begin{tabular}{${ll}}\n\t\t${} \\\\\n\t\\end{tabular}\n\t\\caption{${caption}}\n\t\\label{tab:${label}}',
  tabular: '\t${} \\\\',
  frame: '\t\\frametitle{${title}}\n\t${}',
  equation: '\t${}',
  align: '\t${} &= ${} \\\\',
};

export const ENV_ARGS = {
  figure: '[htbp]', table: '[htbp]', tabular: '{${ll}}', tabularx: '{\\textwidth}{${X}}', minipage: '{${0.5}\\textwidth}',
  frame: '', array: '{${cc}}', column: '{${0.5}\\textwidth}', multicols: '{${2}}', wrapfigure: '{${r}}{${0.4}\\textwidth}',
  subfigure: '{${0.45}\\textwidth}', lstlisting: '[language=${Python}]', minted: '{${python}}', axis: '[${}]',
};

export const PACKAGES = [
  'amsmath', 'amssymb', 'amsthm', 'mathtools', 'graphicx', 'xcolor', 'hyperref', 'geometry', 'booktabs', 'tabularx', 'longtable',
  'multirow', 'array', 'caption', 'subcaption', 'float', 'wrapfig', 'tikz', 'pgfplots', 'babel', 'inputenc', 'fontenc', 'lmodern',
  'microtype', 'fontspec', 'polyglossia', 'csquotes', 'biblatex', 'natbib', 'cleveref', 'enumitem', 'fancyhdr', 'titlesec',
  'setspace', 'parskip', 'listings', 'minted', 'algorithm', 'algpseudocode', 'siunitx', 'physics', 'chemfig', 'mhchem', 'xspace',
  'url', 'lipsum', 'blindtext', 'multicol', 'appendix', 'glossaries', 'makeidx', 'todonotes', 'tcolorbox', 'framed', 'soul',
  'ulem', 'textcomp', 'eurosym', 'pdfpages', 'import', 'subfiles', 'standalone', 'datetime2', 'etoolbox', 'xparse', 'calc', 'ifthen',
];

export const DOCUMENT_CLASSES = ['article', 'report', 'book', 'letter', 'beamer', 'memoir', 'scrartcl', 'scrreprt', 'scrbook', 'amsart', 'standalone', 'moderncv', 'IEEEtran', 'llncs', 'revtex4-2'];

export const SYMBOLS = {
  Greek: ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon', '\\zeta', '\\eta', '\\theta', '\\vartheta', '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi', '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau', '\\upsilon', '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega', '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi', '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega'],
  Operators: ['\\pm', '\\mp', '\\times', '\\div', '\\cdot', '\\ast', '\\star', '\\circ', '\\bullet', '\\oplus', '\\ominus', '\\otimes', '\\oslash', '\\odot', '\\cup', '\\cap', '\\sqcup', '\\sqcap', '\\vee', '\\wedge', '\\setminus', '\\wr', '\\sum', '\\prod', '\\coprod', '\\int', '\\iint', '\\oint', '\\bigcup', '\\bigcap', '\\bigoplus', '\\bigotimes', '\\partial', '\\nabla', '\\sqrt{x}', '\\frac{a}{b}'],
  Relations: ['=', '\\neq', '<', '>', '\\leq', '\\geq', '\\ll', '\\gg', '\\approx', '\\sim', '\\simeq', '\\cong', '\\equiv', '\\propto', '\\prec', '\\succ', '\\preceq', '\\succeq', '\\subset', '\\supset', '\\subseteq', '\\supseteq', '\\in', '\\ni', '\\notin', '\\mid', '\\parallel', '\\perp', '\\models', '\\vdash', '\\dashv', '\\doteq'],
  Arrows: ['\\leftarrow', '\\rightarrow', '\\leftrightarrow', '\\Leftarrow', '\\Rightarrow', '\\Leftrightarrow', '\\longleftarrow', '\\longrightarrow', '\\Longleftarrow', '\\Longrightarrow', '\\mapsto', '\\longmapsto', '\\uparrow', '\\downarrow', '\\updownarrow', '\\Uparrow', '\\Downarrow', '\\nearrow', '\\searrow', '\\swarrow', '\\nwarrow', '\\hookleftarrow', '\\hookrightarrow', '\\rightleftharpoons', '\\to', '\\gets', '\\implies', '\\iff'],
  Misc: ['\\infty', '\\forall', '\\exists', '\\nexists', '\\neg', '\\emptyset', '\\varnothing', '\\aleph', '\\hbar', '\\ell', '\\Re', '\\Im', '\\wp', '\\angle', '\\triangle', '\\square', '\\clubsuit', '\\diamondsuit', '\\heartsuit', '\\spadesuit', '\\dagger', '\\ddagger', '\\S', '\\P', '\\copyright', '\\ldots', '\\cdots', '\\vdots', '\\ddots', '\\prime', '\\top', '\\bot', '\\mathbb{R}', '\\mathbb{N}', '\\mathbb{Z}', '\\mathbb{Q}', '\\mathbb{C}'],
  Accents: ['\\hat{a}', '\\check{a}', '\\tilde{a}', '\\acute{a}', '\\grave{a}', '\\dot{a}', '\\ddot{a}', '\\breve{a}', '\\bar{a}', '\\vec{a}', '\\widehat{ab}', '\\widetilde{ab}', '\\overline{ab}', '\\underline{ab}', '\\overrightarrow{ab}', '\\overbrace{ab}', '\\underbrace{ab}'],
  Delimiters: ['(', ')', '[', ']', '\\{', '\\}', '\\langle', '\\rangle', '\\lfloor', '\\rfloor', '\\lceil', '\\rceil', '|', '\\|', '\\left( \\right)', '\\left[ \\right]', '\\left\\{ \\right\\}', '\\left| \\right|', '\\left\\langle \\right\\rangle'],
};

// Rough Unicode preview for the symbol palette.
export const SYMBOL_GLYPHS = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ϵ', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\vartheta': 'ϑ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\varrho': 'ϱ', '\\sigma': 'σ',
  '\\varsigma': 'ς', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'ϕ', '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω', '\\Gamma': 'Γ', '\\Delta': 'Δ',
  '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  '\\pm': '±', '\\mp': '∓', '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\ast': '∗', '\\star': '⋆', '\\circ': '∘', '\\bullet': '•', '\\oplus': '⊕', '\\ominus': '⊖',
  '\\otimes': '⊗', '\\oslash': '⊘', '\\odot': '⊙', '\\cup': '∪', '\\cap': '∩', '\\sqcup': '⊔', '\\sqcap': '⊓', '\\vee': '∨', '\\wedge': '∧', '\\setminus': '∖', '\\wr': '≀',
  '\\sum': '∑', '\\prod': '∏', '\\coprod': '∐', '\\int': '∫', '\\iint': '∬', '\\oint': '∮', '\\bigcup': '⋃', '\\bigcap': '⋂', '\\bigoplus': '⨁', '\\bigotimes': '⨂',
  '\\partial': '∂', '\\nabla': '∇', '\\sqrt{x}': '√x', '\\frac{a}{b}': 'a⁄b', '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\ll': '≪', '\\gg': '≫', '\\approx': '≈',
  '\\sim': '∼', '\\simeq': '≃', '\\cong': '≅', '\\equiv': '≡', '\\propto': '∝', '\\prec': '≺', '\\succ': '≻', '\\preceq': '⪯', '\\succeq': '⪰', '\\subset': '⊂',
  '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\ni': '∋', '\\notin': '∉', '\\mid': '∣', '\\parallel': '∥', '\\perp': '⊥', '\\models': '⊨',
  '\\vdash': '⊢', '\\dashv': '⊣', '\\doteq': '≐', '\\leftarrow': '←', '\\rightarrow': '→', '\\leftrightarrow': '↔', '\\Leftarrow': '⇐', '\\Rightarrow': '⇒',
  '\\Leftrightarrow': '⇔', '\\longleftarrow': '⟵', '\\longrightarrow': '⟶', '\\Longleftarrow': '⟸', '\\Longrightarrow': '⟹', '\\mapsto': '↦', '\\longmapsto': '⟼',
  '\\uparrow': '↑', '\\downarrow': '↓', '\\updownarrow': '↕', '\\Uparrow': '⇑', '\\Downarrow': '⇓', '\\nearrow': '↗', '\\searrow': '↘', '\\swarrow': '↙', '\\nwarrow': '↖',
  '\\hookleftarrow': '↩', '\\hookrightarrow': '↪', '\\rightleftharpoons': '⇌', '\\to': '→', '\\gets': '←', '\\implies': '⟹', '\\iff': '⟺', '\\infty': '∞',
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄', '\\neg': '¬', '\\emptyset': '∅', '\\varnothing': '⌀', '\\aleph': 'ℵ', '\\hbar': 'ℏ', '\\ell': 'ℓ', '\\Re': 'ℜ',
  '\\Im': 'ℑ', '\\wp': '℘', '\\angle': '∠', '\\triangle': '△', '\\square': '□', '\\clubsuit': '♣', '\\diamondsuit': '♢', '\\heartsuit': '♡', '\\spadesuit': '♠',
  '\\dagger': '†', '\\ddagger': '‡', '\\S': '§', '\\P': '¶', '\\copyright': '©', '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱', '\\prime': '′',
  '\\top': '⊤', '\\bot': '⊥', '\\mathbb{R}': 'ℝ', '\\mathbb{N}': 'ℕ', '\\mathbb{Z}': 'ℤ', '\\mathbb{Q}': 'ℚ', '\\mathbb{C}': 'ℂ', '\\hat{a}': 'â', '\\check{a}': 'ǎ',
  '\\tilde{a}': 'ã', '\\acute{a}': 'á', '\\grave{a}': 'à', '\\dot{a}': 'ȧ', '\\ddot{a}': 'ä', '\\breve{a}': 'ă', '\\bar{a}': 'ā', '\\vec{a}': 'a⃗', '\\widehat{ab}': 'âb',
  '\\widetilde{ab}': 'ãb', '\\overline{ab}': 'a̅b̅', '\\underline{ab}': 'a̲b̲', '\\overrightarrow{ab}': 'ab⃗', '\\overbrace{ab}': '⏞', '\\underbrace{ab}': '⏟',
  '\\{': '{', '\\}': '}', '\\langle': '⟨', '\\rangle': '⟩', '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉', '\\|': '‖',
  '\\left( \\right)': '( )', '\\left[ \\right]': '[ ]', '\\left\\{ \\right\\}': '{ }', '\\left| \\right|': '| |', '\\left\\langle \\right\\rangle': '⟨ ⟩',
};
