#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "VelaraGameMode.generated.h"

/**
 * VELARA game mode — default pawn VelaraCharacter, mixed-city map.
 */
UCLASS()
class VELARAUE_API AVelaraGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AVelaraGameMode();
};
