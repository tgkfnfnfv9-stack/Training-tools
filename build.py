from pathlib import Path
root = Path(__file__).resolve().parent
source = root / 'src'
html = (source / 'index.html').read_text(encoding='utf-8')
html = html.replace('<!-- TESTER_LESSON -->', (source / 'tester.html').read_text(encoding='utf-8'))
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (source / 'style.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('<link rel="stylesheet" href="tester.css">', '<style>' + (source / 'tester.css').read_text(encoding='utf-8') + '</style>')
for script_name in ['leveling.js','machine-accuracy.js','leveling-ui.js','accuracy-ui.js','machine-accuracy-ui.js','reference-measurement.js','reference-measurement-ui.js','spindle-sweep.js','horizontal-parallelism.js','horizontal-parallelism-ui.js','spindle-sweep-ui.js']:
    html = html.replace(f'<script src="{script_name}"></script>', '<script>' + (source / script_name).read_text(encoding='utf-8') + '</script>')
html = html.replace('<script src="app.js"></script>', '<script>' + (source / 'app.js').read_text(encoding='utf-8') + '</script>')
html = html.replace('<script src="tester.js"></script>', '<script>' + (source / 'tester.js').read_text(encoding='utf-8') + '</script>')
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html を更新しました。')
