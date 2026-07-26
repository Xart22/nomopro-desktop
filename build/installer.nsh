!include x64.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrRep}

!macro preInit
    ; --- LOGIKA MEMATIKAN APLIKASI LAMA (Dipindahkan ke preInit agar 100% tereksekusi) ---
    SetDetailsPrint textonly
    
    ; Mengecek apakah file .exe utama aplikasi Anda sedang berjalan
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    
    ${If} $R0 == 0
      DetailPrint `Found running process ${APP_EXECUTABLE_FILENAME}. Attempting force close...`

      StrCpy $R1 0
      StrCpy $R2 6

      kill_loop:
        ; Melakukan force-kill beserta seluruh child-process (termasuk Python/Link Server)
        nsExec::Exec `taskkill /f /t /im "${APP_EXECUTABLE_FILENAME}"`
        Pop $R3
        
        Sleep 2000
        
        nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
        Pop $R0
        
        ${If} $R0 != 0
          DetailPrint `Process closed, continue installation...`
          Goto check_done
        ${EndIf}

        IntOp $R1 $R1 + 1
        ${If} $R1 < $R2
          DetailPrint `Close attempt $R1/$R2 failed, retrying...`
          Goto kill_loop
        ${EndIf}

        DetailPrint `Process still detected after retries. Continue without interactive retry dialog.`
    ${EndIf}

    check_done:
    SetDetailsPrint none
    ; --- AKHIR LOGIKA MEMATIKAN APLIKASI ---


    ; --- LOGIKA REGISTRY BAWAAN ANDA ---
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

    ; Copy bundled AVR core + tools (avr-gcc, avrdude, etc.) to AppData.
    ; These persist across app updates. Structure mirrors arduino-cli's package dir.
    ;
    ; Source:  $INSTDIR/resources/avr-core/packages/arduino/
    ; Dest:    %APPDATA%/nomokit-desktop/arduino-data/packages/arduino/
    ;
    ; Only copy if not already present (e.g. first install or after clean uninstall).
    IfFileExists "$APPDATA\nomokit-desktop\arduino-data\packages\arduino\hardware\avr" avr_done 0
    IfFileExists "$INSTDIR\resources\avr-core\packages\arduino" 0 avr_done
    CreateDirectory "$APPDATA\nomokit-desktop\arduino-data\packages"
    CopyFiles /SILENT "$INSTDIR\resources\avr-core\packages\arduino" \
               "$APPDATA\nomokit-desktop\arduino-data\packages\"
    DetailPrint "AVR core and tools bundled, copied to AppData."
    avr_done:
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

    ; Tanya user: hapus data Arduino (cores, library) atau tidak
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Hapus juga data Arduino (board cores, library) di AppData?$\r$\n\
         Jika tidak, data akan tetap tersimpan untuk instalasi ulang nanti." \
        /SD IDNO IDYES delete_arduino_data
    Goto arduino_done

    delete_arduino_data:
        ; Nama folder AppData sesuai package.json name field
        RMDir /r "$APPDATA\nomokit-desktop\arduino-data"
        RMDir /r "$APPDATA\nomokit-desktop\libraries"
        RMDir /r "$APPDATA\nomokit-desktop\library-version.json"
        RMDir /r "$APPDATA\nomokit-desktop\link-data"
        DetailPrint "Data Arduino berhasil dihapus."

    arduino_done:
!macroend
