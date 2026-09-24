// Project templates. Each template yields a map of path -> text and the main file.

const exampleBib = `@book{knuth1984,
  author    = {Donald E. Knuth},
  title     = {The {\\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984},
}

@article{lamport1986,
  author  = {Leslie Lamport},
  title   = {{\\LaTeX}: A Document Preparation System},
  journal = {Addison-Wesley},
  year    = {1986},
}
`;

const blank = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

\\title{Untitled}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\end{document}
`;

const example = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{hyperref}

\\title{An Example Document}
\\author{FreeTex User}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
This is a short example showing sections, mathematics, tables, lists,
cross-references and a bibliography.
\\end{abstract}

\\tableofcontents

\\section{Introduction}\\label{sec:intro}
Welcome to FreeTex! Edit this text on the left and press
\\textbf{Recompile} (or \\texttt{Ctrl+S}) to update the PDF on the right.
\\TeX{} was created by Knuth~\\cite{knuth1984}; \\LaTeX{} by Lamport~\\cite{lamport1986}.

\\section{Mathematics}\\label{sec:math}
Inline math such as $E = mc^2$ and displayed equations:
\\begin{equation}\\label{eq:gauss}
  \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
\\end{equation}
Equation~\\eqref{eq:gauss} is the Gaussian integral.
\\begin{align}
  (a+b)^2 &= a^2 + 2ab + b^2 \\\\
  (a-b)^2 &= a^2 - 2ab + b^2
\\end{align}

\\section{Lists and tables}
\\begin{itemize}
  \\item First item
  \\item Second item with \\emph{emphasis}
\\end{itemize}

\\begin{table}[h]
  \\centering
  \\begin{tabular}{lrr}
    \\toprule
    Item & Quantity & Price \\\\
    \\midrule
    Apples & 3 & 1.20 \\\\
    Pears  & 5 & 2.10 \\\\
    \\bottomrule
  \\end{tabular}
  \\caption{A simple table.}\\label{tab:simple}
\\end{table}

See Section~\\ref{sec:intro} and Table~\\ref{tab:simple}.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`;

const report = `\\documentclass[12pt,a4paper]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Report Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle
\\tableofcontents

\\input{chapters/introduction}
\\input{chapters/conclusion}

\\end{document}
`;

const beamer = `\\documentclass{beamer}
\\usetheme{Madrid}
\\usepackage[utf8]{inputenc}

\\title{Presentation Title}
\\subtitle{A subtitle}
\\author{Presenter}
\\institute{Institution}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}
\\begin{frame}{Introduction}
  \\begin{itemize}
    \\item<1-> First point
    \\item<2-> Second point
    \\item<3-> Third point
  \\end{itemize}
\\end{frame}

\\section{Results}
\\begin{frame}{Results}
  \\begin{columns}
    \\column{0.5\\textwidth}
    Some text on the left.
    \\column{0.5\\textwidth}
    \\[ f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(0)}{n!} x^n \\]
  \\end{columns}
\\end{frame}

\\end{document}
`;

const letter = `\\documentclass{letter}
\\usepackage[utf8]{inputenc}
\\signature{Your Name}
\\address{Street 1 \\\\ 1234 City \\\\ Country}

\\begin{document}
\\begin{letter}{Recipient \\\\ Street 2 \\\\ 5678 Town}
\\opening{Dear Sir or Madam,}

This is the body of the letter.

\\closing{Yours faithfully,}
\\end{letter}
\\end{document}
`;

const cv = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[margin=2cm]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\pagestyle{empty}
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\setlist{nosep,leftmargin=*}

\\begin{document}
\\begin{center}
  {\\LARGE\\bfseries Jane Doe}\\\\[4pt]
  \\href{mailto:jane@example.com}{jane@example.com} \\,|\\, +00 123 456 789 \\,|\\, City, Country
\\end{center}

\\section{Experience}
\\textbf{Senior Engineer}, Company \\hfill 2020 -- present
\\begin{itemize}
  \\item Led the development of an important product.
  \\item Improved performance by 40\\%.
\\end{itemize}

\\section{Education}
\\textbf{MSc Computer Science}, University \\hfill 2018

\\section{Skills}
\\LaTeX, Python, JavaScript, Communication

\\end{document}
`;

const thesis = `\\documentclass[12pt,a4paper,twoside,openright]{book}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{graphicx}
\\usepackage[backend=biber,style=numeric]{biblatex}
\\usepackage{hyperref}
\\addbibresource{references.bib}

\\newtheorem{theorem}{Theorem}[chapter]

\\title{Thesis Title}
\\author{Student Name}
\\date{\\today}

\\begin{document}
\\frontmatter
\\maketitle
\\tableofcontents

\\mainmatter
\\include{chapters/introduction}
\\include{chapters/conclusion}

\\backmatter
\\printbibliography

\\end{document}
`;

const hungarian = `\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[magyar]{babel}
\\usepackage{amsmath}

\\title{Cikk címe}
\\author{Szerző neve}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Bevezetés}
Ez egy magyar nyelvű dokumentum. Az ékezetes betűk (á, é, í, ó, ö, ő, ú, ü, ű)
helyesen jelennek meg.

\\section{Matematika}
Így írhatunk képleteket:
\\[ E = mc^2 \\]

\\end{document}
`;

const chapterIntro = `\\chapter{Introduction}\\label{ch:intro}
This is the introduction. We cite a classic book~\\cite{knuth1984}.
`;
const chapterConclusion = `\\chapter{Conclusion}\\label{ch:conclusion}
This is the conclusion, referring back to Chapter~\\ref{ch:intro}.
`;

export const TEMPLATES = [
  { id: 'blank', name: 'Blank project', description: 'An empty article.', files: { 'main.tex': blank } },
  { id: 'example', name: 'Example project', description: 'Article with math, tables and bibliography.', files: { 'main.tex': example, 'references.bib': exampleBib } },
  {
    id: 'report', name: 'Report', description: 'Multi-file report with chapters.',
    files: { 'main.tex': report, 'chapters/introduction.tex': chapterIntro.replace('~\\cite{knuth1984}', ''), 'chapters/conclusion.tex': chapterConclusion },
  },
  {
    id: 'thesis', name: 'Thesis / Book', description: 'Book class, chapters and biblatex.',
    files: { 'main.tex': thesis, 'chapters/introduction.tex': chapterIntro, 'chapters/conclusion.tex': chapterConclusion, 'references.bib': exampleBib },
  },
  { id: 'beamer', name: 'Presentation (Beamer)', description: 'Slides with the Madrid theme.', files: { 'main.tex': beamer } },
  { id: 'letter', name: 'Letter', description: 'A formal letter.', files: { 'main.tex': letter } },
  { id: 'cv', name: 'CV / Résumé', description: 'A clean one-page CV.', files: { 'main.tex': cv } },
  { id: 'hungarian', name: 'Hungarian article', description: 'Article with Hungarian babel setup.', files: { 'main.tex': hungarian } },
];
