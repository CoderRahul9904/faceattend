$BASE = "http://localhost:8001"
$headers = @{"Content-Type"="application/json"}

function Invoke-API($method, $path, $body=$null, $token=$null, $label="") {
    $h = @{"Content-Type"="application/json"}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    $uri = "$BASE$path"
    try {
        if ($body) {
            $resp = Invoke-WebRequest -Uri $uri -Method $method -Headers $h -Body ($body | ConvertTo-Json) -ErrorAction Stop
        } else {
            $resp = Invoke-WebRequest -Uri $uri -Method $method -Headers $h -ErrorAction Stop
        }
        Write-Host "[$label] STATUS: $($resp.StatusCode)"
        return $resp.Content | ConvertFrom-Json
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $msg = $_.ErrorDetails.Message
        Write-Host "[$label] ERROR $code : $msg"
        return $null
    }
}

Write-Host "=== STEP 1: Health Check ==="
Invoke-API "GET" "/" -label "HealthCheck"

Write-Host ""
Write-Host "=== STEP 4: Register Teacher ==="
$teacher = Invoke-API "POST" "/auth/register" @{
    name="Demo Teacher"; email="teacher@test.com"; password="demo123"; role="teacher"
} -label "TeacherRegister"
$teacher | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 5: Teacher Login ==="
$teacherLogin = Invoke-API "POST" "/auth/login" @{
    email="teacher@test.com"; password="demo123"
} -label "TeacherLogin"
$teacherToken = $teacherLogin.access_token
Write-Host "Token obtained: $($teacherToken -ne $null)"

Write-Host ""
Write-Host "=== STEP 6: Register Student ==="
$student = Invoke-API "POST" "/auth/register" @{
    name="Rahul Moury"; email="rahul@test.com"; password="demo123"; role="student"; student_id="STU001"
} -label "StudentRegister"
$student | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 9: Duplicate Email Test ==="
$dup = Invoke-API "POST" "/auth/register" @{
    name="Another Person"; email="rahul@test.com"; password="demo123"; role="student"; student_id="STU002"
} -label "DuplicateEmail"

Write-Host ""
Write-Host "=== STEP 10: Login as teacher ==="
$tl = Invoke-API "POST" "/auth/login" @{email="teacher@test.com"; password="demo123"} -label "TeacherLogin2"
$tt = $tl.access_token

Write-Host ""
Write-Host "=== STEP 11: Create Subject CS301 ==="
$s1 = Invoke-API "POST" "/subjects/" @{name="Data Structures"; code="CS301"} -token $tt -label "CreateCS301"
$s1 | ConvertTo-Json
$subjectId = $s1.id

Write-Host ""
Write-Host "=== STEP 11b: Create Subject CS401 ==="
$s2 = Invoke-API "POST" "/subjects/" @{name="Database Management Systems"; code="CS401"} -token $tt -label "CreateCS401"
$s2 | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 11c: List Subjects ==="
$subjects = Invoke-API "GET" "/subjects/" -token $tt -label "ListSubjects"
$subjects | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 12: Start Session on CS301 (5s interval) ==="
$sess = Invoke-API "POST" "/sessions/start" @{subject_id=$subjectId; scan_interval_seconds=5} -token $tt -label "StartSession"
$sess | ConvertTo-Json
$sessionId = $sess.session_id

Write-Host ""
Write-Host "=== STEP 12b: Check Active Session ==="
$active = Invoke-API "GET" "/sessions/active" -token $tt -label "ActiveSession"
$active | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 18: Stop Session (skipping live scan - no camera) ==="
$stop = Invoke-API "POST" "/sessions/stop" @{session_id=$sessionId} -token $tt -label "StopSession"
$stop | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 18b: Check Completed Session in List ==="
$pastSess = Invoke-API "GET" "/sessions/" -token $tt -label "PastSessions"
$pastSess | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 19: GET Attendance for Session ==="
$att = Invoke-API "GET" "/attendance/session/$sessionId" -token $tt -label "Attendance"
$att | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 20: Export Excel for Session ==="
try {
    $xh = @{"Authorization"="Bearer $tt"; "Accept"="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    $resp = Invoke-WebRequest -Uri "$BASE/attendance/session/$sessionId/export" -Method GET -Headers $xh -ErrorAction Stop
    Write-Host "[ExcelExport] STATUS: $($resp.StatusCode), Content-Type: $($resp.Headers['Content-Type']), Bytes: $($resp.Content.Length)"
    $outPath = "C:\Users\moury\Desktop\faceattend\backend\test_export.xlsx"
    [System.IO.File]::WriteAllBytes($outPath, $resp.Content)
    Write-Host "[ExcelExport] File saved to: $outPath"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[ExcelExport] ERROR $code : $($_.ErrorDetails.Message)"
}

Write-Host ""
Write-Host "=== STEP 21/22: Student Login ==="
$sl = Invoke-API "POST" "/auth/login" @{email="rahul@test.com"; password="demo123"} -label "StudentLogin"
$st = $sl.access_token
Write-Host "Student token obtained: $($st -ne $null)"

Write-Host ""
Write-Host "=== STEP 22: Student Attendance Stats ==="
$stats = Invoke-API "GET" "/students/attendance-stats" -token $st -label "StudentStats"
$stats | ConvertTo-Json

Write-Host ""
Write-Host "=== STEP 22b: Student Attendance Records ==="
$records = Invoke-API "GET" "/students/attendance" -token $st -label "StudentAttendance"
$records | ConvertTo-Json

Write-Host ""
Write-Host "=== DATABASE CHECK: Verify tables are not empty ==="
Write-Host "Note: face_encodings not tested (no camera available - Step 7 SKIPPED)"

Write-Host ""
Write-Host "=== DONE ==="
