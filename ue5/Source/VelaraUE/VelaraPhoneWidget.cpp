#include "VelaraPhoneWidget.h"

// UVelaraPhoneWidget — v0.9.0: call-flow native side (banner/ringtone WBP me).

bool UVelaraPhoneWidget::AnswerCall()
{
	if (bCallActive) return false;
	bCallActive = true;
	OnCallStateChanged.Broadcast(true);
	return true;
}

bool UVelaraPhoneWidget::DeclineCall()
{
	if (bCallActive) return false;
	bCallActive = false;
	OnCallStateChanged.Broadcast(false);
	return true;
}

void UVelaraPhoneWidget::HangUp()
{
	if (!bCallActive) return;
	bCallActive = false;
	OnCallStateChanged.Broadcast(false);
}
