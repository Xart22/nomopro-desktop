!include x64.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrRep}

!macro preInit
    ; --- LOGIKA REGISTRY BAWAAN ANDA ---
    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    ; NOTE: InstallLocation is managed by electron-builder from the actual
    ; $INSTDIR (per-user install, directory is user-changeable). Do not
    ; hardcode it here — a fixed path breaks update/uninstall when the
    ; user installed elsewhere.

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

    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"

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
