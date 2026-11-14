#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "VelaraPhoneWidget.generated.h"

/**
 * VELARA OS Phone (v0.8.0) — three.js src/ui/ui.js phone ka UE5 mirror.
 * GTA-style in-game smartphone: MAP / STATS / SETTINGS tabs, music/sfx/haptics
 * toggles. Widget Blueprint me layout bind hota hai (WBP_VelaraPhone) —
 * C++ yahan state + logic handle karta hai.
 *
 * Scaffold: Phase-2 me minimap render target + mission list + audio bus
 * routing. Open/close: gamepad/taap se TogglePhone().
 */
UCLASS()
class VELARAUE_API UVelaraPhoneWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	enum class EPhoneTab : uint8 { Map, Stats, Settings };

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void TogglePhone() { bOpen = !bOpen; OnPhoneStateChanged(); }

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void OpenPhone() { bOpen = true; OnPhoneStateChanged(); }

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void ClosePhone() { bOpen = false; OnPhoneStateChanged(); }

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	bool IsPhoneOpen() const { return bOpen; }

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void SelectTab(EPhoneTab Tab) { CurrentTab = Tab; OnPhoneStateChanged(); }

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	EPhoneTab GetTab() const { return CurrentTab; }

	// toggles — phone SETTINGS mirror (ui.js ph-tgl-*)
	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	bool ToggleMusic() { bMusicOn = !bMusicOn; return bMusicOn; }

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	bool ToggleSfx() { bSfxOn = !bSfxOn; return bSfxOn; }

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	bool ToggleHaptics() { bHapticsOn = !bHapticsOn; return bHapticsOn; }

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	bool IsMusicOn() const { return bMusicOn; }

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	bool IsSfxOn() const { return bSfxOn; }

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	bool IsHapticsOn() const { return bHapticsOn; }

	// ---- v0.9.0 CALLS (gameplay/calls.js ka mirror) ----
	// Incoming call flow: game mode IsCallIncoming() -> widget banner +
	// ringtone; AnswerCall/DeclineCall se state chalta hai.
	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	bool AnswerCall();

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	bool DeclineCall();

	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void HangUp();

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	bool IsCallActive() const { return bCallActive; }

	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCallStateChanged, bool, bActive);
	UPROPERTY(BlueprintAssignable, Category = "Velara|Phone")
	FOnCallStateChanged OnCallStateChanged;

	// STATS tab — live values (game.js setPhoneStats mirror)
	UFUNCTION(BlueprintCallable, Category = "Velara|Phone")
	void UpdateStats(int32 Cash, int32 HealthPct, int32 WantedStars, int32 GangKills)
	{
		StatsCash = Cash; StatsHealth = HealthPct;
		StatsWanted = WantedStars; StatsGangKills = GangKills;
	}

	UFUNCTION(BlueprintPure, Category = "Velara|Phone")
	int32 GetStatsCash() const { return StatsCash; }

protected:
	// Blueprint-implementable refresh (WBP layout update)
	UFUNCTION(BlueprintImplementableEvent, Category = "Velara|Phone")
	void OnPhoneStateChanged();

private:
	bool bOpen = false;
	EPhoneTab CurrentTab = EPhoneTab::Map;
	bool bMusicOn = true;
	bool bSfxOn = true;
	bool bHapticsOn = true;

	bool bCallActive = false;

	int32 StatsCash = 0;
	int32 StatsHealth = 100;
	int32 StatsWanted = 0;
	int32 StatsGangKills = 0;
};
