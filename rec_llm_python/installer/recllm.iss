; RecLLM Inno Setup Script
; Builds: RecLLM-Setup-v0.3.0.exe

#define MyAppName "RecLLM"
#define MyAppVersion "0.3.0"
#define MyAppPublisher "RecLLM"
#define MyAppURL "https://github.com/stackahmedo/rec_llm"
#define MyAppExeName "RecLLM.exe"

[Setup]
AppId={{B8F2A1C3-4D5E-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\installer_output
OutputBaseFilename=RecLLM-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\RecLLM.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Do NOT delete user data by default — only app files
Type: filesandordirs; Name: "{app}"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  MsgResult: Integer;
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{userappdata}\recllm-data');
    if DirExists(DataDir) then
    begin
      MsgResult := MsgBox(
        'Do you want to remove your RecLLM data (recordings, transcripts, settings)?'#13#10#13#10 +
        'Location: ' + DataDir + #13#10#13#10 +
        'Click Yes to delete all data, or No to keep it.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2);
      if MsgResult = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
