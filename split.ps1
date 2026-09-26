$content = [System.IO.File]::ReadAllText("app.js", [System.Text.Encoding]::UTF8)
$blocks = $content -split '// ================= '

if (-not (Test-Path "src")) {
    New-Item -ItemType Directory -Path "src" | Out-Null
}

$fileContents = @{}

foreach ($block in $blocks) {
    if ([string]::IsNullOrWhiteSpace($block)) { continue }
    
    $lines = $block -split "`n", 2
    $header = $lines[0].Trim()
    $text = $lines[1]
    
    $filePath = ""
    if ($header -match 'IMPORTA') { $filePath = 'src/firebase-config.js' }
    elseif ($header -match 'CSS E HTML') { $filePath = 'src/ui-utils.js' }
    elseif ($header -match 'NOTIFICA') { $filePath = 'src/ui-utils.js' }
    elseif ($header -match 'CACHE LOCAL') { $filePath = 'src/globals.js' }
    elseif ($header -match 'MODAIS') { $filePath = 'src/ui-utils.js' }
    elseif ($header -match 'ROTEADOR') { $filePath = 'src/router.js' }
    elseif ($header -match 'SINCRONIZA') { $filePath = 'src/sync.js' }
    elseif ($header -match 'PRODUTOS') { $filePath = 'src/produtos.js' }
    elseif ($header -match 'USU') { $filePath = 'src/usuarios.js' }
    elseif ($header -match 'SITUA') { $filePath = 'src/estoque.js' }
    elseif ($header -match 'RECEITAS') { $filePath = 'src/receitas.js' }
    elseif ($header -match 'FROTA') { $filePath = 'src/vagoes.js' }
    elseif ($header -match 'TR') { $filePath = 'src/nuvem.js' }
    elseif ($header -match 'CARGA POR') { $filePath = 'src/carga-vagao.js' }
    elseif ($header -match 'MODAL DETALHES RETORNO BOUTIQUE') { $filePath = 'src/boutiques-modal.js' }
    elseif ($header -match 'CARGA GERAL') { $filePath = 'src/carga-dia.js' }
    elseif ($header -match 'ABA P') { $filePath = 'src/manifesto.js' }
    elseif ($header -match 'MONITOR') { $filePath = 'src/monitor.js' }
    elseif ($header -match 'BOUTIQUES HUB') { $filePath = 'src/boutiques-hub.js' }
    elseif ($header -match 'CONTAGEM') { $filePath = 'src/contagem.js' }
    elseif ($header -match 'CARRINHO') { $filePath = 'src/carrinho.js' }
    elseif ($header -match 'RELAT') { $filePath = 'src/relatorios.js' }
    elseif ($header -match 'INICIALIZA') { $filePath = 'src/init.js' }

    if ($filePath -ne "") {
        if (-not $fileContents.ContainsKey($filePath)) {
            $fileContents[$filePath] = ""
        }
        $fileContents[$filePath] += "`n// ================= " + $header + "`n" + $text
    } else {
        Write-Host "Unmapped header: $header"
    }
}

foreach ($filePath in $fileContents.Keys) {
    [System.IO.File]::WriteAllText($filePath, $fileContents[$filePath].Trim(), [System.Text.Encoding]::UTF8)
}

$mainContent = ""
foreach ($filePath in $fileContents.Keys) {
    $baseName = Split-Path $filePath -Leaf
    $mainContent += "import './$baseName';`n"
}
[System.IO.File]::WriteAllText("src/main.js", $mainContent, [System.Text.Encoding]::UTF8)

Write-Host "Splitting done!"
