!include x64.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrRep}

!macro preInit

    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Nomokit-Desktop"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\Nomokit-Desktop"

    ${StrRep} $0 "${UNINSTALL_REGISTRY_KEY}" "Software" "SOFTWARE"
    ${StrRep} $1 "${INSTALL_REGISTRY_KEY}" "Software" "SOFTWARE"

    ReadRegStr $R0 HKCU "$0" "UninstallString"
    ReadRegStr $R1 HKCU "$1" "InstallLocation"

    StrCmp $R0 "" 0 +4

    ReadRegStr $R0 HKLM "$0" "UninstallString"
    ReadRegStr $R1 HKLM "$1" "InstallLocation"

    StrCmp $R0 "" 0 done
    StrCmp $R1 "" 0 done

done:
    ${If} ${RunningX64}
        SetRegView LastUsed
    ${EndIf}

!macroend

!macro customInstall
    ; Enable long path support for Arduino toolchain (avr-gcc, ld.exe)
    ; Windows 10 1607+ requires this key + longPathAware manifest
    WriteRegDWORD HKLM "SYSTEM\CurrentControlSet\Control\FileSystem" "LongPathsEnabled" 1
!macroend

!macro customUnInstall

    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"

    ${If} ${RunningX64}
        SetRegView LastUsed
    ${EndIf}

!macroend

!macro customCheckAppRunning
  SetDetailsPrint textonly
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    DetailPrint `Found running process ${APP_EXECUTABLE_FILENAME}. Attempting force close...`

    StrCpy $R1 0
    StrCpy $R2 6

    kill_loop:
      nsExec::Exec `taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}"` $R3
      Sleep 2000
      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 != 0
        DetailPrint `Process closed, continue installation...`
        Goto check_done
      ${endIf}

      IntOp $R1 $R1 + 1
      ${if} $R1 < $R2
        DetailPrint `Close attempt $R1/$R2 failed, retrying...`
        Goto kill_loop
      ${endIf}

      DetailPrint `Process still detected after retries. Continue without interactive retry dialog.`
  ${endIf}

  check_done:
  SetDetailsPrint none
!macroend
