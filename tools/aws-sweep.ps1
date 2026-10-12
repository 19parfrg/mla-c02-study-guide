<#
.SYNOPSIS
  Read-only sweep for study-lab leftovers that keep billing. Run after every AWS mission.
.EXAMPLE
  .\tools\aws-sweep.ps1 -Region us-east-2 -Profile grant
#>
param(
    [string]$Region = "us-east-2",
    [string]$Profile = $(if ($env:AWS_PROFILE) { $env:AWS_PROFILE } else { "grant" })
)
$env:PYTHONUTF8 = "1"   # the CLI crashes on non-ASCII output under the default Windows code page

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "AWS CLI not found. Install it with: winget install Amazon.AWSCLI"
    exit 1
}
$who = aws sts get-caller-identity --profile $Profile --query Account --output text 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not signed in to AWS as profile '$Profile'. Run: aws login --profile $Profile`n$who"
    exit 1
}
Write-Host "Account $who · Profile $Profile · Region $Region`n"

# name, why it matters, CLI arguments (each returns a tab-separated list of resource names)
$checks = @(
    @("SageMaker endpoints",            "bill per instance-hour",        @("sagemaker", "list-endpoints", "--query", "Endpoints[].EndpointName")),
    @("SageMaker notebook instances",   "bill while InService",          @("sagemaker", "list-notebook-instances", "--query", "NotebookInstances[?NotebookInstanceStatus!='Stopped'].NotebookInstanceName")),
    @("SageMaker Studio apps",          "bill while running",            @("sagemaker", "list-apps", "--query", "Apps[?Status=='InService'].AppName")),
    @("SageMaker training jobs",        "in progress",                   @("sagemaker", "list-training-jobs", "--status-equals", "InProgress", "--query", "TrainingJobSummaries[].TrainingJobName")),
    @("SageMaker tuning jobs",          "in progress",                   @("sagemaker", "list-hyper-parameter-tuning-jobs", "--status-equals", "InProgress", "--query", "HyperParameterTuningJobSummaries[].HyperParameterTuningJobName")),
    @("SageMaker feature groups",       "online store bills for storage", @("sagemaker", "list-feature-groups", "--query", "FeatureGroupSummaries[].FeatureGroupName")),
    @("Bedrock knowledge bases",        "vector store may bill hourly",  @("bedrock-agent", "list-knowledge-bases", "--query", "knowledgeBaseSummaries[].name")),
    @("Bedrock agents",                 "clean up after the lab",        @("bedrock-agent", "list-agents", "--query", "agentSummaries[].agentName")),
    @("Bedrock provisioned throughput", "bills hourly",                  @("bedrock", "list-provisioned-model-throughputs", "--query", "provisionedModelSummaries[].provisionedModelName")),
    @("Bedrock guardrails",             "clean up after the lab",        @("bedrock", "list-guardrails", "--query", "guardrails[].name")),
    @("OpenSearch Serverless",          "bills minimum capacity hourly", @("opensearchserverless", "list-collections", "--query", "collectionSummaries[].name")),
    @("S3 vector buckets",              "bill for storage",              @("s3vectors", "list-vector-buckets", "--query", "vectorBuckets[].vectorBucketName")),
    @("Kinesis data streams",           "bill per shard-hour",           @("kinesis", "list-streams", "--query", "StreamNames")),
    @("Glue interactive sessions",  "bill while provisioned",        @("glue", "list-sessions", "--query", "Sessions[?Status=='READY'].Id")),
    @("EMR clusters",                   "bill while running",            @("emr", "list-clusters", "--active", "--query", "Clusters[].Name")),
    @("NAT gateways",                   "bill hourly",                   @("ec2", "describe-nat-gateways", "--filter", "Name=state,Values=available", "--query", "NatGateways[].NatGatewayId")),
    @("VPC interface endpoints",        "bill hourly",                   @("ec2", "describe-vpc-endpoints", "--filters", "Name=vpc-endpoint-type,Values=Interface", "--query", "VpcEndpoints[].VpcEndpointId"))
)

$found = 0; $unchecked = 0
foreach ($c in $checks) {
    $cliArgs = $c[2] + @("--region", $Region, "--profile", $Profile, "--output", "text")
    $out = & aws @cliArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $why = if (($out | Out-String) -match 'service control policy') { "blocked for this project" } else { (($out | Out-String).Trim() -split "`n")[-1] }
        Write-Host ("  ?  {0,-32} could not check: {1}" -f $c[0], $why) -ForegroundColor DarkGray
        $unchecked++
        continue
    }
    $names = @(($out | Out-String) -split "\s+" | Where-Object { $_ -and $_ -ne "None" })
    if ($names.Count) {
        $found += $names.Count
        Write-Host ("  !  {0,-32} {1} ({2})" -f $c[0], ($names -join ", "), $c[1]) -ForegroundColor Yellow
    } else {
        Write-Host ("  ok {0}" -f $c[0]) -ForegroundColor Green
    }
}

Write-Host ""
if ($found) {
    Write-Host "$found resource(s) still exist in $Region. Delete what you are finished with." -ForegroundColor Yellow
} elseif ($unchecked -eq $checks.Count) {
    Write-Host "Could not check anything. Is $Region the Region your project allows?" -ForegroundColor Red
} else {
    Write-Host "Clean. Nothing from the study labs is running in $Region." -ForegroundColor Green
}
if ($unchecked) { Write-Host "$unchecked check(s) were skipped: those services are blocked for this project, so nothing can be running there." }
Write-Host "S3 buckets and CloudWatch log groups are not listed here; they cost little but check them at the end of each chapter."
