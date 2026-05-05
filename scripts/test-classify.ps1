$base = "http://localhost:3000/api/classify"
$headers = @{ "Content-Type" = "application/json" }

$ideas = @(
    "AI tool for students to focus while studying",
    "Marketplace for freelance video editors to find recurring clients",
    "Subscription billing platform for small SaaS founders",
    "App that helps remote teams plan async standups",
    "AI assistant for medieval falconers to track their birds"
)

foreach ($idea in $ideas) {
    Write-Host "`n--- $idea ---" -ForegroundColor Cyan
    $body = @{ idea = $idea } | ConvertTo-Json
    try {
        $result = Invoke-RestMethod -Uri $base -Method POST -Headers $headers -Body $body
        $result | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}
