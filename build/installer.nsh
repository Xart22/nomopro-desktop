!include x64.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrRep}

; electron-builder runs CHECK_APP_RUNNING before install; when this macro
; is defined it replaces the default taskkill logic. The default gives up
; after 2 attempts (appCannotBeClosed dialog). Old app versions (<= 3.0.17)
; have no single-instance lock, so a zombie Nomokit-Desktop.exe can survive
; quitAndInstall(). Kill the whole process tree (child Electron/node procs)
; and retry up to 15x before asking the user.
!macro customCheckAppRunning
  DetailPrint "Closing running Nomokit-Desktop processes..."
  StrCpy $R1 0
  ckar_loop:
    IntOp $R1 $R1 + 1
    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 != 0
      Goto ckar_done
    ${EndIf}
    ; Graceful close first so renderer/GPU child processes exit on their own.
    ; No /fi "USERNAME eq %USERNAME%" filter: when the installer runs
    ; elevated (perMachine + allowElevation), %USERNAME% is the admin
    ; account while the app belongs to the logged-in user, so the filter
    ; matched nothing and taskkill never killed the app.
    ${nsProcess::CloseProcess} "${APP_EXECUTABLE_FILENAME}" $R2
    Sleep 1000
    nsExec::ExecToLog `cmd /c taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}"`
    Sleep 800
    ${If} $R1 < 15
      Goto ckar_loop
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY ckar_retry
    Quit
  ckar_retry:
    StrCpy $R1 0
    Goto ckar_loop
  ckar_done:
    Sleep 300
!macroend

!macro preInit
    ; --- LOGIKA REGISTRY BAWAAN ANDA ---
    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

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

; Runs AFTER initMultiUser (installer.nsi .onInit), so it wins over the
; per-user default $LOCALAPPDATA\Programs path. Fixes the dual-install bug:
; perMachine:true forced PROGRAMFILES64 and left the old C:\Nomokit-Desktop
; install behind. Path is now locked for every install/update.
!macro customInit
    StrCpy $INSTDIR "C:\Nomokit-Desktop"
!macroend

!macro customInstall
    ; Enable long path support for Arduino toolchain (avr-gcc, ld.exe)
    ; Windows 10 1607+ requires this key + longPathAware manifest.
    ; Best-effort only: per-user installs run asInvoker without HKLM
    ; rights, and a failed write must never abort install/update.
    ClearErrors
    WriteRegDWORD HKLM "SYSTEM\CurrentControlSet\Control\FileSystem" "LongPathsEnabled" 1
    ClearErrors

    ; Copy bundled AVR core + tools (avr-gcc, avrdude, etc.) to dedicated data dir.
    ; These persist across app updates. Structure mirrors arduino-cli's package dir.
    ;
    ; Source:  $INSTDIR/resources/avr-core/packages/arduino/
    ; Dest:    C:\NomokitData\arduino-data\packages\arduino\
    ;
    ; Only copy if not already present (e.g. first install or after clean uninstall).
    IfFileExists "C:\NomokitData\arduino-data\packages\arduino\hardware\avr" avr_done 0
    IfFileExists "$INSTDIR\resources\avr-core\packages\arduino" 0 avr_done
    CreateDirectory "C:\NomokitData\arduino-data\packages"
    CopyFiles /SILENT "$INSTDIR\resources\avr-core\packages\arduino" \
               "C:\NomokitData\arduino-data\packages\"
    DetailPrint "AVR core and tools bundled, copied to C:\NomokitData."
    avr_done:
!macroend

!macro customUnInstall
    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    ; Delete only this install scope's key. Deleting both HKLM+HKCU orphaned
    ; the other install's uninstall entry when two scopes coexisted.
    DeleteRegKey SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}"

    ${If} ${RunningX64}
        SetRegView LastUsed
    ${EndIf}

    ; Tanya user: hapus data Arduino (cores, library) atau tidak
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Hapus juga data Arduino (board cores, library) di C:\NomokitData?$\r$\n\
         Jika tidak, data akan tetap tersimpan untuk instalasi ulang nanti." \
        /SD IDNO IDYES delete_arduino_data
    Goto arduino_done

    delete_arduino_data:
        RMDir /r "C:\NomokitData\arduino-data"
        RMDir /r "$APPDATA\nomokit-desktop\libraries"
        RMDir /r "$APPDATA\nomokit-desktop\library-version.json"
        RMDir /r "$APPDATA\nomokit-desktop\link-data"
        DetailPrint "Data Arduino berhasil dihapus."

    arduino_done:
!macroend
