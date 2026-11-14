using UnrealBuildTool;

public class VelaraUE : ModuleRules
{
	public VelaraUE(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"Json",
			"JsonUtilities"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			// v0.8.0: phone widget (UMG) — WBP_VelaraPhone scaffold
			"UMG",
			"Slate",
			"SlateCore"
		});
	}
}
