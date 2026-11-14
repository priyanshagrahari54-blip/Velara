#include "VelaraGameMode.h"
#include "VelaraCharacter.h"
#include "UObject/ConstructorHelpers.h"

AVelaraGameMode::AVelaraGameMode()
{
	// default pawn — mixed-city foot hero
	DefaultPawnClass = AVelaraCharacter::StaticClass();
}
